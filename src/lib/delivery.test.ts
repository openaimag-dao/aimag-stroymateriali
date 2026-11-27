import { describe, expect, it } from "vitest";
import { cityDeliveryNote, formatWeight, parseEstimate } from "./delivery";

describe("delivery", () => {
  it("parseEstimate приводит числа из numeric-строк", () => {
    expect(parseEstimate({ weight_kg: "653.5", unknown_lines: 0, vehicle: "Газель до 1,5 т", cost_kzt: "10000", max_kg: "20000.0" })).toEqual({
      weightKg: 653.5,
      unknownLines: 0,
      vehicle: "Газель до 1,5 т",
      costKzt: 10000,
      maxKg: 20000,
    });
    expect(parseEstimate({ weight_kg: "25000", unknown_lines: 0, vehicle: null, cost_kzt: null, max_kg: "20000" })?.costKzt).toBeNull();
    expect(parseEstimate(null)).toBeNull();
  });

  it("formatWeight", () => {
    expect(formatWeight(653.5)).toBe("654 кг");
    expect(formatWeight(3240)).toBe("3,2 т");
  });

  it("cityDeliveryNote", () => {
    expect(cityDeliveryNote({ weightKg: 653.5, unknownLines: 0, vehicle: "Газель до 1,5 т", costKzt: 10000, maxKg: 20000 })).toBe(
      "Газель до 1,5 т, вес заказа 654 кг. Доставка войдёт в КП и счёт.",
    );
    expect(cityDeliveryNote({ weightKg: 25000, unknownLines: 0, vehicle: null, costKzt: null, maxKg: 20000 })).toMatch(/больше 20 т/);
    expect(cityDeliveryNote({ weightKg: 10, unknownLines: 1, vehicle: "Газель до 1,5 т", costKzt: null, maxKg: 20000 })).toMatch(/Вес части/);
  });
});
