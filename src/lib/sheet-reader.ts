import "server-only";
import ExcelJS from "exceljs";
import type { Cell } from "@/lib/price-import";
import { cellValue, decodeText, parseCsv } from "@/lib/sheet-cells";

export { parseCsv };

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

function readCsv(buf: ArrayBuffer): Sheet {
  return fromMatrix(parseCsv(decodeText(buf)));
}

function fromMatrix(all: Cell[][]): Sheet {
  const headerIdx = all.slice(0, 15).findIndex((r) => r && isHeaderRow(r));
  if (headerIdx < 0) throw new Error("Не нашёл строку заголовков: в ней должна быть колонка «Наименование». Возьмите шаблон.");
  const headers = (all[headerIdx] ?? []).map((h) => String(h ?? "").trim());
  const rows = all.slice(headerIdx + 1).map((r) => r ?? []);
  if (rows.length > MAX_ROWS) throw new Error(`В файле больше ${MAX_ROWS} строк — разбейте прайс на части.`);
  return { headers, rows, firstRowNo: headerIdx + 2 };
}
