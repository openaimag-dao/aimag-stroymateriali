import { describe, expect, it } from "vitest";
import { calcRoof, coveringColors, pickProduct, validate, type CalcProduct, type RoofInput } from "./roof-calc";

const p = (id: string, categorySlug: string, priceKzt: number, ral?: string): CalcProduct => ({
  id,
  name: id,
  unit: "шт",
  priceKzt,
  categorySlug,
  attrs: ral ? { ral } : {},
});

const products: CalcProduct[] = [
  p("mt-3005", "metal-tile", 2700, "RAL3005"),
  p("mt-8017", "metal-tile", 2700, "RAL8017"),
  p("pn-zn", "profnastil", 810),
  p("pn-8017", "profnastil", 2660, "RAL8017"),
  p("ridge-8017", "roof-extras", 2500, "RAL8017"),
  p("ridge-3005", "roof-extras", 2500, "RAL3005"),
  p("membrane", "roof-membranes", 27420),
  p("screws-8017", "roof-fasteners", 3750, "RAL8017"),
  p("gutter-8017", "gutters", 3600, "RAL8017"),
  p("gutter-9003", "gutters", 3600, "RAL9003"),
];

const base: RoofInput = {
  type: "gable",
  length: 10,
  width: 8,
  pitch: 30,
  overhang: 0.5,
  covering: "metal-tile",
  withGutters: true,
  withMembrane: true,
};

describe("calcRoof", () => {
  it("двускатная 10×8 м, 30°, свес 0,5 м", () => {
    const r = calcRoof(base, products, "RAL8017");
    // скат: (4 + 0,5) / cos30° = 5,196 м; карниз 11 м; площадь 2 × 5,196 × 11 = 114,32 м²
    expect(r.slopeLength).toBeCloseTo(5.2, 2);
    expect(r.eaveLength).toBe(11);
    expect(r.area).toBeCloseTo(114.32, 2);
    const q = Object.fromEntries(r.lines.map((l) => [l.key, l.qty]));
    expect(q.covering).toBe(132); // 114,32 × 1,15 = 131,47
    expect(q.ridge).toBe(13); // 11 × 1,1 = 12,1
    expect(q.membrane).toBe(2); // 131,47 / 70 = 1,88
    expect(q.screws).toBe(4); // 914,6 шт / 250
    expect(q.gutters).toBe(8); // 2 × ceil(11 / 3)
    expect(r.lines.every((l) => l.product?.attrs.ral === "RAL8017" || !l.product?.attrs.ral)).toBe(true);
    expect(r.warnings).toEqual([]);
  });

  it("односкатная: без конька, один карниз", () => {
    const r = calcRoof({ ...base, type: "shed", pitch: 10, covering: "profnastil", withMembrane: false }, products, "RAL8017");
    // скат: (8 + 1) / cos10° = 9,139 м; площадь 9,139 × 11 = 100,53 м²
    expect(r.area).toBeCloseTo(100.53, 2);
    expect(r.lines.map((l) => l.key)).toEqual(["covering", "screws", "gutters"]);
    expect(r.lines[0].qty).toBe(111); // × 1,1 = 110,6
    expect(r.lines[0].product?.id).toBe("pn-8017");
    expect(r.lines[2].qty).toBe(4);
  });

  it("предупреждает о малом уклоне и о подмене цвета", () => {
    const r = calcRoof({ ...base, pitch: 10 }, products, "RAL3005");
    expect(r.warnings[0]).toMatch(/не меньше 14°/);
    expect(r.warnings.some((w) => w.startsWith("Саморезы") && w.includes("RAL 8017"))).toBe(true);
    expect(r.warnings.some((w) => w.startsWith("Желоб"))).toBe(true);
  });

  it("раздел без товаров даёт строку без товара", () => {
    const r = calcRoof(base, products.filter((x) => x.categorySlug !== "roof-membranes"), null);
    expect(r.lines.find((l) => l.key === "membrane")?.product).toBeNull();
  });
});

describe("helpers", () => {
  it("pickProduct: цвет, затем окрашенный, затем любой", () => {
    expect(pickProduct(products, "profnastil", "RAL6005")?.id).toBe("pn-8017");
    expect(pickProduct(products, "roof-membranes", "RAL8017")?.id).toBe("membrane");
    expect(pickProduct(products, "nothing", null)).toBeNull();
  });

  it("coveringColors", () => {
    expect(coveringColors(products, "metal-tile")).toEqual(["RAL3005", "RAL8017"]);
  });

  it("validate", () => {
    expect(validate(base)).toBeNull();
    expect(validate({ ...base, pitch: 70 })).toMatch(/Угол/);
    expect(validate({ ...base, length: Number.NaN })).toMatch(/Длина/);
  });
});
