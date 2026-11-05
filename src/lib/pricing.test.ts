import { describe, expect, it } from "vitest";
import { sellingPrice, totals, unitPriceForQty } from "./pricing";
import { isValidBin } from "./bin";

describe("sellingPrice", () => {
  it("applies rate, logistics, markup and 16% VAT", () => {
    // (100 RUB × 5.6 + 40) × 1.20 × 1.16 = 835.2 → 836
    expect(sellingPrice({ purchase: 100, rateKztPerUnit: 5.6, logisticsKzt: 40, markupPct: 20 })).toBe(836);
  });

  it("keeps whole-tenge results exact", () => {
    // 1000 × 1.25 × 1.16 = 1450
    expect(sellingPrice({ purchase: 1000, rateKztPerUnit: 1, markupPct: 25 })).toBe(1450);
  });

  it("rejects a zero rate", () => {
    expect(() => sellingPrice({ purchase: 1, rateKztPerUnit: 0, markupPct: 10 })).toThrow(RangeError);
  });
});

describe("unitPriceForQty", () => {
  const tiers = [
    { minQty: 100, priceKzt: 900 },
    { minQty: 1000, priceKzt: 850 },
  ];
  it("uses base price below the first tier", () => expect(unitPriceForQty(1000, tiers, 99)).toBe(1000));
  it("picks the tier reached", () => expect(unitPriceForQty(1000, tiers, 100)).toBe(900));
  it("picks the deepest tier", () => expect(unitPriceForQty(1000, tiers, 5000)).toBe(850));
});

describe("totals", () => {
  it("extracts VAT from a gross that includes delivery", () => {
    const t = totals([{ qty: 10, unitPriceKzt: 1160 }], 0);
    expect(t).toEqual({ goodsKzt: 11600, deliveryKzt: 0, totalKzt: 11600, vatKzt: 1600, netKzt: 10000 });
  });
});

describe("isValidBin", () => {
  it("accepts real BIN/IIN numbers", () => {
    expect(isValidBin("890922301639")).toBe(true);
    expect(isValidBin("050404601141")).toBe(true);
  });
  it("rejects a wrong check digit or length", () => {
    expect(isValidBin("890922301638")).toBe(false);
    expect(isValidBin("12345")).toBe(false);
  });
});
