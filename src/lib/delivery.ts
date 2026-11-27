/** Оценка доставки по городу из delivery_estimate: вес заказа → машина → стоимость. */
export type DeliveryEstimate = {
  weightKg: number;
  unknownLines: number;
  vehicle: string | null;
  costKzt: number | null;
  maxKg: number | null;
};

export function parseEstimate(row: Record<string, unknown> | null | undefined): DeliveryEstimate | null {
  if (!row) return null;
  const num = (v: unknown) => (v === null || v === undefined || v === "" ? null : Number(v));
  return {
    weightKg: num(row.weight_kg) ?? 0,
    unknownLines: Number(row.unknown_lines ?? 0),
    vehicle: (row.vehicle as string | null) ?? null,
    costKzt: num(row.cost_kzt),
    maxKg: num(row.max_kg),
  };
}

/** «654 кг», «3,2 т». */
export function formatWeight(kg: number): string {
  if (kg >= 1000) return `${(Math.round(kg / 100) / 10).toLocaleString("ru-RU")} т`;
  return `${Math.ceil(kg).toLocaleString("ru-RU")} кг`;
}

/** Пояснение под выбором доставки по городу. */
export function cityDeliveryNote(e: DeliveryEstimate): string {
  if (e.unknownLines > 0) return "Вес части товаров не указан — стоимость доставки менеджер рассчитает и добавит в КП.";
  if (e.costKzt === null) {
    const limit = e.maxKg ? ` больше ${formatWeight(e.maxKg)}` : "";
    return `Заказ${limit} — нужно несколько машин, стоимость менеджер рассчитает и добавит в КП.`;
  }
  return `${e.vehicle}, вес заказа ${formatWeight(e.weightKg)}. Доставка войдёт в КП и счёт.`;
}
