import "server-only";
import ExcelJS from "exceljs";
import type { Cell } from "@/lib/price-import";

export const MAX_ROWS = 5000;
export const MAX_BYTES = 5 * 1024 * 1024;

export type Sheet = { headers: string[]; rows: Cell[][]; firstRowNo: number };

/** Reads the first sheet of an .xlsx or a .csv; the header row is the first row containing «Наименование». */
export async function readSheet(file: File): Promise<Sheet> {
  const name = file.name.toLowerCase();
  if (file.size > MAX_BYTES) throw new Error("Файл больше 5 МБ — разбейте прайс на части.");
  if (name.endsWith(".csv")) return readCsv(await file.arrayBuffer());
  if (name.endsWith(".xlsx")) return readXlsx(await file.arrayBuffer());
  throw new Error("Подходят файлы .xlsx или .csv. Старый формат .xls сохраните как .xlsx.");
}

function cellValue(v: ExcelJS.CellValue): Cell {
  if (v === null || v === undefined) return null;
  if (typeof v === "string" || typeof v === "number" || typeof v === "boolean") return v;
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  if (typeof v === "object") {
    if ("richText" in v) return v.richText.map((t) => t.text).join("");
    if ("result" in v) return cellValue(v.result as ExcelJS.CellValue);
    if ("text" in v) return String(v.text);
    if ("error" in v) return null;
  }
  return String(v);
}

const isHeaderRow = (cells: Cell[]) => cells.some((c) => String(c ?? "").trim().toLowerCase() === "наименование");

async function readXlsx(buf: ArrayBuffer): Promise<Sheet> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buf);
  const ws = wb.worksheets[0];
  if (!ws) throw new Error("В файле нет листов.");

  const all: Cell[][] = [];
  ws.eachRow({ includeEmpty: true }, (row, rowNumber) => {
    if (rowNumber > MAX_ROWS + 20) return;
    const values = row.values as ExcelJS.CellValue[]; // 1-based
    all[rowNumber - 1] = values.slice(1).map(cellValue);
  });
  return fromMatrix(all);
}

function decode(buf: ArrayBuffer): string {
  const utf8 = new TextDecoder("utf-8").decode(buf);
  // Excel on Windows often saves CSV in cp1251
  return utf8.includes("�") ? new TextDecoder("windows-1251").decode(buf) : utf8.replace(/^﻿/, "");
}

export function parseCsv(text: string): string[][] {
  const firstLine = text.split(/\r?\n/, 1)[0] ?? "";
  const delim = (firstLine.match(/;/g)?.length ?? 0) >= (firstLine.match(/,/g)?.length ?? 0) ? ";" : ",";
  const rows: string[][] = [];
  let row: string[] = [];
  let cur = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') { cur += '"'; i++; }
      else if (ch === '"') quoted = false;
      else cur += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === delim) { row.push(cur); cur = ""; }
    else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(cur); rows.push(row); row = []; cur = "";
    } else cur += ch;
  }
  if (cur !== "" || row.length) { row.push(cur); rows.push(row); }
  return rows;
}

function readCsv(buf: ArrayBuffer): Sheet {
  return fromMatrix(parseCsv(decode(buf)));
}

function fromMatrix(all: Cell[][]): Sheet {
  const headerIdx = all.slice(0, 15).findIndex((r) => r && isHeaderRow(r));
  if (headerIdx < 0) throw new Error("Не нашёл строку заголовков: в ней должна быть колонка «Наименование». Возьмите шаблон.");
  const headers = (all[headerIdx] ?? []).map((h) => String(h ?? "").trim());
  const rows = all.slice(headerIdx + 1).map((r) => r ?? []);
  if (rows.length > MAX_ROWS) throw new Error(`В файле больше ${MAX_ROWS} строк — разбейте прайс на части.`);
  return { headers, rows, firstRowNo: headerIdx + 2 };
}
