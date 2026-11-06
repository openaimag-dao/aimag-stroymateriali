// Shared catalog types (used by server loaders and client components).

export type AttrOption = { value: string; label: string; hex: string | null };

export type CatalogAttr = {
  code: string;
  name: string;
  unit: string | null;
  kind: "enum" | "color";
  isFilter: boolean;
  isVariant: boolean;
  options: AttrOption[];
};

export type Sku = {
  id: string;
  name: string;
  spec: string | null;
  unit: string;
  priceKzt: number;
  inStock: boolean;
  leadTimeDays: number | null;
  tiers: { minQty: number; priceKzt: number }[];
  attrs: Record<string, string>; // attribute code → option value
};

export type CatalogGroup = {
  id: string;
  name: string;
  description: string | null;
  categoryName: string;
  skus: Sku[]; // empty for guests (prices after login)
};

export type CategoryNode = { id: number; parentId: number | null; slug: string; name: string; sort: number };

/** Filters from the URL: ?f.ral=RAL3005&f.ral=RAL8017&f.thickness=0.50 */
export type Filters = Record<string, string[]>;

export function parseFilters(sp: Record<string, string | string[] | undefined>): Filters {
  const out: Filters = {};
  for (const [k, v] of Object.entries(sp)) {
    if (!k.startsWith("f.") || v === undefined) continue;
    const values = (Array.isArray(v) ? v : [v]).filter((x) => x.length > 0 && x.length <= 40);
    if (values.length) out[k.slice(2)] = values.slice(0, 30);
  }
  return out;
}

export function skuMatches(sku: Sku, filters: Filters): boolean {
  return Object.entries(filters).every(([code, values]) => values.includes(sku.attrs[code]));
}

/**
 * Picks the SKU after the buyer clicks `value` on axis `code`: keep the other choices
 * when such a variant exists, otherwise jump to the first variant that has this value.
 */
export function pickSku(skus: Sku[], current: Record<string, string>, code: string, value: string): Sku | undefined {
  const wanted = { ...current, [code]: value };
  const exact = skus.find((s) => Object.entries(wanted).every(([c, v]) => s.attrs[c] === v));
  if (exact) return exact;
  const withValue = skus.filter((s) => s.attrs[code] === value);
  // prefer the variant sharing the most other choices, then in stock
  return withValue
    .map((s) => ({ s, score: Object.entries(current).filter(([c, v]) => c !== code && s.attrs[c] === v).length }))
    .sort((a, b) => b.score - a.score || Number(b.s.inStock) - Number(a.s.inStock))[0]?.s;
}

/** Whether choosing `value` on `code` keeps every other current choice. */
export function optionCompatible(skus: Sku[], current: Record<string, string>, code: string, value: string): boolean {
  return skus.some((s) => s.attrs[code] === value && Object.entries(current).every(([c, v]) => c === code || s.attrs[c] === v));
}
