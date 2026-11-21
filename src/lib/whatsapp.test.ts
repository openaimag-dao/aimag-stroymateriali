import { describe, expect, it } from "vitest";
import { cartMessage, waLink } from "./whatsapp";
import { formatTenge } from "./money";

describe("whatsapp", () => {
  it("builds a wa.me link with encoded text", () => {
    expect(waLink()).toBe("https://wa.me/77056151717");
    expect(waLink("Привет & цена?")).toBe("https://wa.me/77056151717?text=" + encodeURIComponent("Привет & цена?"));
  });

  it("lists cart items with total", () => {
    const text = cartMessage(
      [
        { name: "Цемент М500, 50 кг", unit: "мешок", qty: 40, priceKzt: 2000 },
        { name: "Кабель ВВГнг(А) 3×2,5", unit: "м", qty: 100, priceKzt: 390 },
      ],
      "Самовывоз",
    );
    expect(text).toContain("1. Цемент М500, 50 кг — 40 мешок × " + formatTenge(2000));
    expect(text).toContain("Итого по сайту: " + formatTenge(119000) + " с НДС");
    expect(text).toContain("Доставка: Самовывоз");
  });
});
