/**
 * Файл заявки → вход для Claude: таблицы и Word — текстом, PDF — документом, фото — картинкой.
 * Ничего не обрезаем молча: слишком большой или нечитаемый файл помечается для ручного разбора.
 */
import ExcelJS from "exceljs";
import JSZip from "jszip";
import type Anthropic from "@anthropic-ai/sdk";
import { cellValue, decodeText, parseCsv } from "@/lib/sheet-cells";

type Block = Anthropic.Beta.BetaContentBlockParam;

export type SpecInput = { ok: true; blocks: Block[]; kind: string } | { ok: false; reason: string };

/** Около 150 тыс. символов текста — с запасом помещается в контекст вместе с каталогом. */
export const MAX_TEXT_CHARS = 150_000;
const MAX_SHEETS = 10;
const MAX_IMAGE_BYTES = 5 * 1024 * 1024; // предел API для одной картинки
const MAX_PDF_BYTES = 20 * 1024 * 1024;

const ext = (name: string) => name.toLowerCase().split(".").pop() ?? "";

export async function buildSpecInput(fileName: string, data: ArrayBuffer): Promise<SpecInput> {
  const e = ext(fileName);
  try {
    if (e === "xlsx") return textInput(await xlsxToText(data), "Excel");
    if (e === "csv") return textInput(csvToText(data), "CSV");
    if (e === "docx") return textInput(await docxToText(data), "Word");
    if (e === "pdf") {
      if (data.byteLength > MAX_PDF_BYTES) return { ok: false, reason: "PDF больше 20 МБ — разбор вручную" };
      return {
        ok: true,
        kind: "PDF",
        blocks: [{ type: "document", source: { type: "base64", media_type: "application/pdf", data: toBase64(data) } }],
      };
    }
    if (e === "jpg" || e === "jpeg" || e === "png") {
      if (data.byteLength > MAX_IMAGE_BYTES) return { ok: false, reason: "Фото больше 5 МБ — разбор вручную" };
      const media_type = e === "png" ? "image/png" : "image/jpeg";
      return { ok: true, kind: "фото", blocks: [{ type: "image", source: { type: "base64", media_type, data: toBase64(data) } }] };
    }
    if (e === "xls" || e === "doc") return { ok: false, reason: `Старый формат .${e} — разбор вручную (или пересохранить как .${e}x)` };
    if (e === "heic") return { ok: false, reason: "Фото HEIC — разбор вручную (или прислать JPG)" };
    return { ok: false, reason: `Формат .${e} не разбирается автоматически` };
  } catch {
    return { ok: false, reason: "Файл не читается (повреждён или защищён паролем) — разбор вручную" };
  }
}

function textInput(text: string, kind: string): SpecInput {
  const t = text.trim();
  if (!t) return { ok: false, reason: `В файле (${kind}) нет текста — разбор вручную` };
  if (t.length > MAX_TEXT_CHARS) return { ok: false, reason: `Заявка слишком большая для автоматического разбора (${kind}) — разбор вручную` };
  return { ok: true, kind, blocks: [{ type: "text", text: `<spec_file kind="${kind}">\n${t}\n</spec_file>` }] };
}

const toBase64 = (data: ArrayBuffer) => Buffer.from(data).toString("base64");

/** Строки таблицы через табуляцию; пустые строки и хвостовые пустые ячейки убираются. */
export function rowsToText(rows: unknown[][]): string {
  return rows
    .map((r) => {
      const cells = r.map((c) => (c === null || c === undefined ? "" : String(c).replace(/[\t\r\n]+/g, " ").trim()));
      while (cells.length && cells[cells.length - 1] === "") cells.pop();
      return cells.join("\t");
    })
    .filter((line) => line.replace(/\t/g, "").trim() !== "")
    .join("\n");
}

export async function xlsxToText(data: ArrayBuffer): Promise<string> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(data);
  const parts: string[] = [];
  for (const ws of wb.worksheets.slice(0, MAX_SHEETS)) {
    if (ws.state && ws.state !== "visible") continue;
    const rows: unknown[][] = [];
    ws.eachRow({ includeEmpty: false }, (row) => {
      rows.push((row.values as ExcelJS.CellValue[]).slice(1).map(cellValue));
    });
    const text = rowsToText(rows);
    if (text) parts.push(`## Лист «${ws.name}»\n${text}`);
  }
  return parts.join("\n\n");
}

export function csvToText(data: ArrayBuffer): string {
  return rowsToText(parseCsv(decodeText(data)));
}

/** Текст .docx: абзацы и строки таблиц (ячейки через табуляцию). */
export async function docxToText(data: ArrayBuffer): Promise<string> {
  const zip = await JSZip.loadAsync(data);
  const xml = await zip.file("word/document.xml")?.async("string");
  if (!xml) return "";
  return docxXmlToText(xml);
}

export function docxXmlToText(xml: string): string {
  const unescape = (s: string) =>
    s.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, "&");
  return xml
    .replace(/<w:tab\/>/g, " ")
    // абзацы внутри ячейки таблицы — через пробел, чтобы строка таблицы осталась одной строкой
    .replace(/<w:tc\b[\s\S]*?<\/w:tc>/g, (cell) => cell.replace(/<\/w:p>|<w:br\/>/g, " "))
    .replace(/<\/w:tc>/g, "\t")
    .replace(/<\/w:tr>|<\/w:p>|<w:br\/>/g, "\n")
    .replace(/<[^>]+>/g, "")
    .split("\n")
    .map((l) =>
      unescape(l)
        .replace(/[ \u00a0]+/g, " ")
        .replace(/ *\t */g, "\t")
        .replace(/\t+$/, "")
        .trim(),
    )
    .filter((l) => l.replace(/\t/g, "").trim() !== "")
    .join("\n");
}
