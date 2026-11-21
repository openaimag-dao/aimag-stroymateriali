import "server-only";
import { cache } from "react";
import { getSupabase } from "@/lib/supabase/server";

export type ProductPage = {
  id: string;
  name: string;
  spec: string | null;
  unit: string;
  priceKzt: number;
  inStock: boolean;
  leadTimeDays: number | null;
  categorySlug: string;
  categoryName: string;
  parentSlug: string | null;
  parentName: string | null;
  groupName: string | null;
  attrs: { name: string; value: string }[];
  tiers: { minQty: number; priceKzt: number }[];
  updatedAt: string;
};

/** Публичная карточка товара (цена с НДС, без закупки). Кешируется в пределах запроса. */
export const getProductPage = cache(async (id: string): Promise<ProductPage | null> => {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const supabase = await getSupabase();
  if (!supabase) return null;
  const { data, error } = await supabase.rpc("catalog_product_public", { p_id: id });
  const r = (data as Record<string, unknown>[] | null)?.[0];
  if (error || !r) return null;
  return {
    id: r.id as string,
    name: r.name as string,
    spec: (r.spec as string | null) ?? null,
    unit: r.unit as string,
    priceKzt: Number(r.price_kzt),
    inStock: Boolean(r.in_stock),
    leadTimeDays: (r.lead_time_days as number | null) ?? null,
    categorySlug: r.category_slug as string,
    categoryName: r.category_name as string,
    parentSlug: (r.parent_slug as string | null) ?? null,
    parentName: (r.parent_name as string | null) ?? null,
    groupName: (r.group_name as string | null) ?? null,
    attrs: (r.attrs as { name: string; value: string }[]) ?? [],
    tiers: ((r.tiers as { min_qty: number; price_kzt: number }[]) ?? []).map((t) => ({ minQty: Number(t.min_qty), priceKzt: Number(t.price_kzt) })),
    updatedAt: r.updated_at as string,
  };
});
