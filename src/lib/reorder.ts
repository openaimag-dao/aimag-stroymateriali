/**
 * Повтор заказа из КП: те же товары и количества, но по текущему каталогу.
 * Цена в корзине — текущая базовая; оптовые уровни и скидку посчитает база при новом КП.
 */
export type ReorderLine = { product_id: string | null; name: string; unit: string; qty: number };
export type CatalogProduct = { id: string; name: string; unit: string; price_kzt: number; is_active: boolean };
export type ReorderItem = { productId: string; name: string; unit: string; priceKzt: number; qty: number };

export function buildReorder(lines: ReorderLine[], products: CatalogProduct[]) {
  const byId = new Map(products.map((p) => [p.id, p]));
  const merged = new Map<string, ReorderItem>();
  const unavailable: string[] = [];

  for (const l of lines) {
    const p = l.product_id ? byId.get(l.product_id) : undefined;
    if (!p || !p.is_active || !(l.qty > 0)) {
      unavailable.push(l.name);
      continue;
    }
    const prev = merged.get(p.id);
    if (prev) prev.qty += l.qty;
    else merged.set(p.id, { productId: p.id, name: p.name, unit: p.unit, priceKzt: Number(p.price_kzt), qty: l.qty });
  }
  return { items: [...merged.values()], unavailable };
}
