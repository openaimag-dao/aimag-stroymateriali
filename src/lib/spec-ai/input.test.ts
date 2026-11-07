import { describe, expect, it } from "vitest";
import ExcelJS from "exceljs";
import JSZip from "jszip";
import { buildSpecInput, docxXmlToText, rowsToText, MAX_TEXT_CHARS } from "./input";

const ab = (b: Buffer | Uint8Array) => b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer;

describe("rowsToText", () => {
  it("joins cells with tabs and drops empty rows and trailing cells", () => {
    expect(rowsToText([["№", "Наименование", "Кол-во", null], [], [null, ""], [1, "Труба\nPP-R", 150, ""]])).toBe(
      "№\tНаименование\tКол-во\n1\tТруба PP-R\t150",
    );
  });
});

describe("docxXmlToText", () => {
  it("keeps table rows on one line and paragraphs on separate lines", () => {
    const xml =
      '<w:document><w:body><w:p><w:r><w:t>Заявка &amp; объект</w:t></w:r></w:p>' +
      "<w:tbl><w:tr><w:tc><w:tcPr/><w:p><w:r><w:t>Труба</w:t></w:r></w:p><w:p><w:r><w:t>PP-R 25</w:t></w:r></w:p></w:tc>" +
      "<w:tc><w:p><w:r><w:t>150 м</w:t></w:r></w:p></w:tc></w:tr></w:tbl></w:body></w:document>";
    expect(docxXmlToText(xml)).toBe("Заявка & объект\nТруба PP-R 25\t150 м");
  });
});

describe("buildSpecInput", () => {
  it("reads all visible sheets of an xlsx", async () => {
    const wb = new ExcelJS.Workbook();
    wb.addWorksheet("Кровля").addRows([["Наименование", "Кол-во"], ["Профнастил С21 0,5", 120]]);
    wb.addWorksheet("Сантехника").addRows([["Труба PP-R 25", 150]]);
    const hidden = wb.addWorksheet("Служебный");
    hidden.state = "hidden";
    hidden.addRow(["секрет"]);
    const res = await buildSpecInput("заявка.xlsx", ab(Buffer.from(await wb.xlsx.writeBuffer())));
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    const block = res.blocks[0];
    expect(block.type).toBe("text");
    const text = block.type === "text" ? block.text : "";
    expect(text).toContain("## Лист «Кровля»\nНаименование\tКол-во\nПрофнастил С21 0,5\t120");
    expect(text).toContain("## Лист «Сантехника»");
    expect(text).not.toContain("секрет");
  });

  it("reads a cp1251 csv", async () => {
    const res = await buildSpecInput("a.csv", ab(new Uint8Array([0xd2, 0xf0, 0xf3, 0xe1, 0xe0, 0x3b, 0x31, 0x30]))); // «Труба;10»
    expect(res.ok && res.blocks[0].type === "text" && res.blocks[0].text).toContain("Труба\t10");
  });

  it("reads a docx", async () => {
    const zip = new JSZip();
    zip.file("word/document.xml", "<w:document><w:body><w:p><w:r><w:t>Цемент М500 — 40 мешков</w:t></w:r></w:p></w:body></w:document>");
    const res = await buildSpecInput("a.docx", ab(await zip.generateAsync({ type: "uint8array" })));
    expect(res.ok && res.blocks[0].type === "text" && res.blocks[0].text).toContain("Цемент М500 — 40 мешков");
  });

  it("passes PDF and photos as document and image blocks", async () => {
    const pdf = await buildSpecInput("a.pdf", ab(Buffer.from("%PDF-1.4")));
    expect(pdf.ok && pdf.blocks[0]).toMatchObject({ type: "document", source: { media_type: "application/pdf" } });
    const jpg = await buildSpecInput("Фото.JPG", ab(Buffer.from([0xff, 0xd8])));
    expect(jpg.ok && jpg.blocks[0]).toMatchObject({ type: "image", source: { media_type: "image/jpeg" } });
  });

  it("sends unsupported, empty, broken and oversized files to manual review", async () => {
    for (const name of ["a.xls", "a.doc", "a.heic"]) {
      expect(await buildSpecInput(name, ab(Buffer.from("x")))).toMatchObject({ ok: false });
    }
    expect(await buildSpecInput("a.csv", ab(Buffer.from(" \n ")))).toMatchObject({ ok: false });
    expect(await buildSpecInput("a.xlsx", ab(Buffer.from("not a zip")))).toMatchObject({ ok: false });
    const big = Buffer.from(("Труба PP-R 25;150\n").repeat(Math.ceil(MAX_TEXT_CHARS / 10)));
    const res = await buildSpecInput("a.csv", ab(big));
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.reason).toContain("слишком большая");
  });
});
