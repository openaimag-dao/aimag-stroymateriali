import { describe, expect, it } from "vitest";
import { buildCatalog, candidateQueries, renderMatchPrompt, toSpecItemRows, type Candidate, type ExtractedItem } from "./match";

const items: ExtractedItem[] = [
  { source_text: "Труба ППР д25 PN20 — 150 м", name: "Труба PP-R PN20 25 мм", search_query: "труба PP-R 25 PN20", qty: 150, unit: "м" },
  { source_text: "Кабель ВВГ 3х2,5 2 бухты по 100м", name: "Кабель ВВГнг 3х2,5", search_query: "кабель ВВГ 3х2,5", qty: 2, unit: "бухта" },
  { source_text: "Монтаж", name: "Монтаж", search_query: "монтаж", qty: null, unit: null },
];

const cand = (q: number, id: string, name: string, rank: number, unit = "м"): Candidate => ({
  q, product_id: id, sku: null, name, spec: null, unit, price_kzt: 100, in_stock: true, attrs: null, rank,
});

// q 1–2 → line 1, q 3–4 → line 2, q 5–6 → line 3
const rows = [
  cand(1, "p25", "Труба PP-R PN20 25 мм", 0.05),
  cand(1, "p32", "Труба PP-R PN20 32 мм", 0.03),
  cand(2, "p32", "Труба PP-R PN20 32 мм", 0.04),
  cand(2, "p25", "Труба PP-R PN20 25 мм", 0.02),
  cand(3, "vvg", "Кабель ВВГнг 3х2,5", 0.03),
];

describe("candidate catalog", () => {
  it("asks two queries per line", () => {
    expect(candidateQueries(items)).toHaveLength(6);
    expect(candidateQueries(items).slice(0, 2)).toEqual(["труба PP-R 25 PN20", "Труба PP-R PN20 25 мм"]);
  });

  it("codes each product once and keeps the best rank per line", () => {
    const cat = buildCatalog(items, rows);
    expect(cat.byCode.size).toBe(3);
    expect(cat.perLine.get(1)).toEqual(["P1", "P2"]); // p25 0.05 > p32 0.04
    expect(cat.perLine.get(2)).toEqual(["P3"]);
    expect(cat.perLine.get(3)).toBeUndefined();
  });

  it("lists products once and lines with their codes", () => {
    const text = renderMatchPrompt(items, buildCatalog(items, rows));
    expect(text.match(/^P1\t/gm)).toHaveLength(1);
    expect(text).toContain("1. Труба PP-R PN20 25 мм — 150 м");
    expect(text).toContain("кандидаты: P1, P2");
    expect(text).toContain("3. Монтаж — кол-во не указано");
    expect(text).toContain("кандидаты: нет");
  });
});

describe("toSpecItemRows", () => {
  const cat = buildCatalog(items, rows);

  it("accepts a code only from the line's own candidates and converts qty to the product unit", () => {
    const out = toSpecItemRows(items, cat, {
      matches: [
        { line: 1, code: "P1", status: "found", qty: 150, confidence: 0.95, note: "" },
        { line: 2, code: "P3", status: "found", qty: 200, confidence: 1.4, note: "2 бухты по 100 м" },
        { line: 3, code: null, status: "not_supplied", qty: null, confidence: 0.9, note: "Это работы" },
      ],
    });
    expect(out[0]).toMatchObject({ product_id: "p25", match_status: "found", qty: 150, unit: "м", candidates: ["p25", "p32"] });
    expect(out[1]).toMatchObject({ product_id: "vvg", match_status: "found", qty: 200, unit: "м", confidence: 1, note: "2 бухты по 100 м" });
    expect(out[2]).toMatchObject({ product_id: null, match_status: "not_supplied", qty: null, note: "Это работы" });
  });

  it("rejects a code from another line and keeps the source qty", () => {
    const out = toSpecItemRows(items, cat, {
      matches: [{ line: 2, code: "P1", status: "found", qty: 5, confidence: 0.8, note: "" }],
    });
    expect(out[1]).toMatchObject({ product_id: null, match_status: "pending", qty: 2, unit: "бухта" });
    expect(out[1].note).toContain("P1");
  });

  it("treats an unknown status as not matched", () => {
    const out = toSpecItemRows(items, cat, { matches: [{ line: 1, code: "P1", status: "maybe", qty: 1, confidence: 0.5, note: "" }] });
    expect(out[0].match_status).toBe("pending");
  });

  it("leaves everything pending when matching did not run", () => {
    const out = toSpecItemRows(items, cat, null);
    expect(out.map((r) => r.match_status)).toEqual(["pending", "pending", "pending"]);
    expect(out[0].candidates).toEqual(["p25", "p32"]);
  });
});
