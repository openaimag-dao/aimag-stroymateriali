import { describe, expect, it } from "vitest";
import { optionCompatible, parseFilters, pickSku, skuMatches, type Sku } from "./catalog-types";

const sku = (id: string, attrs: Record<string, string>, inStock = true): Sku => ({
  id, name: id, spec: null, unit: "м²", priceKzt: 1000, inStock, leadTimeDays: null, tiers: [], attrs,
});

// Профнастил С21: 0,45 — два цвета, 0,50 — только 3005
const skus = [
  sku("a", { thickness: "0.45", ral: "RAL3005" }),
  sku("b", { thickness: "0.45", ral: "RAL8017" }),
  sku("c", { thickness: "0.50", ral: "RAL3005" }),
];

describe("pickSku", () => {
  it("keeps other choices when the combination exists", () => {
    expect(pickSku(skus, { thickness: "0.45", ral: "RAL3005" }, "ral", "RAL8017")?.id).toBe("b");
  });
  it("jumps to the nearest variant when the combination does not exist", () => {
    expect(pickSku(skus, { thickness: "0.45", ral: "RAL8017" }, "thickness", "0.50")?.id).toBe("c");
  });
});

describe("optionCompatible", () => {
  it("marks options that would break the other choice", () => {
    expect(optionCompatible(skus, { thickness: "0.50", ral: "RAL3005" }, "ral", "RAL8017")).toBe(false);
    expect(optionCompatible(skus, { thickness: "0.45", ral: "RAL3005" }, "ral", "RAL8017")).toBe(true);
  });
});

describe("filters", () => {
  it("parses only f.* params and matches all of them", () => {
    const f = parseFilters({ "f.ral": ["RAL3005", "RAL8017"], "f.thickness": "0.45", page: "2" });
    expect(f).toEqual({ ral: ["RAL3005", "RAL8017"], thickness: ["0.45"] });
    expect(skus.filter((s) => skuMatches(s, f)).map((s) => s.id)).toEqual(["a", "b"]);
  });
});
