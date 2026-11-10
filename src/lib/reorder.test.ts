import { describe, expect, it } from "vitest";
import { buildReorder } from "./reorder";

const products = [
  { id: "a", name: "Труба PP-R 25 (новое название)", unit: "м", price_kzt: 520, is_active: true },
  { id: "b", name: "Кабель ВВГ", unit: "м", price_kzt: 450, is_active: false },
];

describe("buildReorder", () => {
  it("takes current names and prices, skips inactive and missing products", () => {
    const r = buildReorder(
      [
        { product_id: "a", name: "Труба PP-R 25", unit: "м", qty: 150 },
        { product_id: "b", name: "Кабель ВВГ", unit: "м", qty: 10 },
        { product_id: null, name: "Позиция вручную", unit: "шт", qty: 1 },
        { product_id: "zzz", name: "Удалённый товар", unit: "шт", qty: 2 },
      ],
      products,
    );
    expect(r.items).toEqual([{ productId: "a", name: "Труба PP-R 25 (новое название)", unit: "м", priceKzt: 520, qty: 150 }]);
    expect(r.unavailable).toEqual(["Кабель ВВГ", "Позиция вручную", "Удалённый товар"]);
  });

  it("merges repeated lines of the same product", () => {
    const r = buildReorder(
      [
        { product_id: "a", name: "x", unit: "м", qty: 100 },
        { product_id: "a", name: "x", unit: "м", qty: 50 },
      ],
      products,
    );
    expect(r.items).toHaveLength(1);
    expect(r.items[0].qty).toBe(150);
  });
});
