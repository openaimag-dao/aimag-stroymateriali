import { siteConfig } from "@/config/site";
import { formatTenge } from "@/lib/money";

/** Ссылка на чат WhatsApp с готовым текстом. */
export function waLink(text?: string): string {
  const base = `https://wa.me/${siteConfig.whatsapp}`;
  return text ? `${base}?text=${encodeURIComponent(text)}` : base;
}

export type WaCartItem = { name: string; unit: string; qty: number; priceKzt: number };

/** Текст заказа из корзины: позиции, количество, сумма по базовым ценам с НДС. */
export function cartMessage(items: WaCartItem[], delivery?: string): string {
  const lines = items.map((i, n) => `${n + 1}. ${i.name} — ${i.qty} ${i.unit} × ${formatTenge(i.priceKzt)}`);
  const sum = items.reduce((s, i) => s + Math.round(i.qty * i.priceKzt), 0);
  return [
    "Здравствуйте! Хочу заказать:",
    ...lines,
    `Итого по сайту: ${formatTenge(sum)} с НДС`,
    delivery ? `Доставка: ${delivery}` : "",
    "Прошу выставить КП / счёт.",
  ]
    .filter(Boolean)
    .join("\n");
}
