/**
 * Pricing rules (see the concept doc):
 *   price = (purchase × rate + logistics) × (1 + markup) × (1 + VAT)
 * The result is the single price stored in products.price_kzt and copied into
 * every КП/счёт line, so the same item never gets two different prices.
 */

export const VAT_PCT = 16;

export type PriceInput = {
  purchase: number; // per unit, without VAT, in purchase currency
  rateKztPerUnit: number; // 1 for KZT
  logisticsKzt?: number; // per unit, to our warehouse
  markupPct: number; // 12–40 by category
  vatPct?: number;
};

/** Selling price with VAT, rounded up to whole tenge (never sell below cost by rounding). */
export function sellingPrice({
  purchase,
  rateKztPerUnit,
  logisticsKzt = 0,
  markupPct,
  vatPct = VAT_PCT,
}: PriceInput): number {
  if (purchase < 0 || rateKztPerUnit <= 0 || markupPct < 0) {
    throw new RangeError("purchase, rate and markup must be non-negative (rate > 0)");
  }
  const cost = purchase * rateKztPerUnit + logisticsKzt;
  const gross = cost * (1 + markupPct / 100) * (1 + vatPct / 100);
  return Math.ceil(Math.round(gross * 100) / 100);
}

export type PriceTier = { minQty: number; priceKzt: number };

/** Unit price for a quantity: the lowest tier whose threshold is reached, else the base price. */
export function unitPriceForQty(basePriceKzt: number, tiers: PriceTier[], qty: number): number {
  let best = basePriceKzt;
  for (const t of tiers) {
    if (qty >= t.minQty && t.priceKzt < best) best = t.priceKzt;
  }
  return best;
}

export type Line = { qty: number; unitPriceKzt: number };

/** Totals for a КП/счёт. Prices already include VAT; VAT is extracted from the gross. */
export function totals(lines: Line[], deliveryKzt = 0, vatPct = VAT_PCT) {
  const goods = lines.reduce((s, l) => s + Math.round(l.qty * l.unitPriceKzt), 0);
  const gross = goods + deliveryKzt;
  const vat = Math.round((gross * vatPct) / (100 + vatPct));
  return { goodsKzt: goods, deliveryKzt, totalKzt: gross, vatKzt: vat, netKzt: gross - vat };
}
