import { describe, expect, it } from "vitest";
import { COLUMNS, matchOption, parseNumber, validateRows, type ImportContext } from "./price-import";

const ctx: ImportContext = {
  rates: { RUB: 5.65 },
  categories: [
    {
      id: 10,
      slug: "profnastil",
      name: "Профнастил",
      markupPct: 20,
      attrs: [
        { id: 1, code: "thickness", name: "Толщина металла", options: [{ value: "0.45", label: "0,45 мм" }, { value: "0.50", label: "0,50 мм" }] },
        { id: 3, code: "ral", name: "Цвет", options: [{ value: "RAL3005", label: "RAL 3005 Красное вино" }, { value: "RAL8017", label: "RAL 8017 Шоколадно-коричневый" }] },
      ],
    },
    {
      id: 20,
      slug: "ppr-fittings",
      name: "Фитинги PP-R",
      markupPct: 30,
      attrs: [{ id: 13, code: "thread", name: "Резьба", options: [{ value: "1-1/4", label: "1 1/4″" }, { value: "1/2", label: "1/2″" }] }],
    },
  ],
};

const H = [COLUMNS.sku, COLUMNS.category, COLUMNS.group, COLUMNS.name, COLUMNS.unit, COLUMNS.purchase, COLUMNS.currency,
  COLUMNS.logistics, COLUMNS.price, COLUMNS.inStock, COLUMNS.tierQty, COLUMNS.tierPrice, "Толщина металла", "Цвет", "Вес"];

describe("parseNumber", () => {
  it.each([["1 234,50", 1234.5], [" 2 890 ₸", 2890], [17, 17], ["", null], ["abc", NaN]])("%s", (v, n) => {
    const r = parseNumber(v as string);
    if (Number.isNaN(n as number)) expect(r).toBeNaN();
    else expect(r).toBe(n);
  });
});

describe("matchOption", () => {
  const thick = ctx.categories[0].attrs[0].options;
  it("matches thickness written in different ways", () => {
    expect(matchOption("0,5", thick)?.value).toBe("0.50");
    expect(matchOption("0.45 мм", thick)?.value).toBe("0.45");
    expect(matchOption("0,7", thick)).toBeUndefined();
  });
  it("matches RAL by number", () => {
    expect(matchOption("ral 8017", ctx.categories[0].attrs[1].options, true)?.value).toBe("RAL8017");
    expect(matchOption("3005 вишня", ctx.categories[0].attrs[1].options, true)?.value).toBe("RAL3005");
  });
  it("matches threads by label", () => {
    expect(matchOption("1 1/4", ctx.categories[1].attrs[0].options)?.value).toBe("1-1/4");
  });
});

describe("validateRows", () => {
  it("prices a RUB row with category markup and VAT, and maps characteristics", () => {
    const [r] = validateRows(H, [["", "Профнастил", "Профнастил С21", "Профнастил С21 0,5 RAL 8017", "м²", 400, "руб", 50, "", "да", 300, 3000, "0,5", "8017", "4,2"]], ctx);
    expect(r.errors).toEqual([]);
    // (400 × 5.65 + 50) × 1.20 × 1.16 = 3215.52 → 3216
    expect(r.row?.priceKzt).toBe(3216);
    expect(r.row?.priceLocked).toBe(false);
    expect(r.row?.currency).toBe("RUB");
    expect(r.row?.inStock).toBe(true);
    expect(r.row?.tier).toEqual({ minQty: 300, priceKzt: 3000 });
    expect(r.row?.attrs).toEqual([{ attributeId: 1, value: "0.50" }, { attributeId: 3, value: "RAL8017" }]);
    expect(r.row?.sku).toMatch(/^AUTO-/);
    expect(r.warnings.join()).toContain("Вес");
  });

  it("uses an explicit selling price and locks it", () => {
    const [r] = validateRows(H, [["P-1", "profnastil", "", "Лист", "м²", "", "", "", "2 999", "", "", "", "", "", ""]], ctx);
    expect(r.errors).toEqual([]);
    expect(r.row).toMatchObject({ sku: "P-1", priceKzt: 2999, priceLocked: true, inStock: false, groupName: null });
  });

  it("reports every problem with the row number", () => {
    const rows = [
      ["X", "Кровельная плитка", "", "", "", 100, "USD", "", "", "", 10, "", "0,7", "", ""],
      ["D", "Профнастил", "", "Лист А", "м²", 100, "", "", "", "", "", "", "", "", ""],
      ["D", "Профнастил", "", "Лист Б", "м²", 100, "", "", "", "", "", "", "", "", ""],
      ["", "", "", "", "", "", "", "", "", "", "", "", "", "", ""],
    ];
    const res = validateRows(H, rows, ctx);
    expect(res).toHaveLength(3); // blank line skipped
    expect(res[0].rowNo).toBe(2);
    expect(res[0].errors.join(" | ")).toMatch(/подраздел .*не найден.*нет наименования.*нет единицы.*USD.*Опт от/);
    expect(res[1].errors).toEqual([]);
    expect(res[2].errors.join()).toContain("повторяется (строка 3)");
  });

  it("asks for a rate when the currency has none", () => {
    const [r] = validateRows(H, [["", "Профнастил", "", "Лист", "м²", 10, "CNY", "", "", "", "", "", "", "", ""]], ctx);
    expect(r.errors.join()).toContain("нет курса CNY");
  });

  it("rejects characteristic values missing from the dictionary", () => {
    const [r] = validateRows(H, [["", "Профнастил", "", "Лист", "м²", 1000, "", "", "", "", "", "", "0,33", "", ""]], ctx);
    expect(r.errors.join()).toContain("Толщина металла: значения «0,33» нет в справочнике");
  });
});
