import "server-only";
import { getSupabase } from "@/lib/supabase/server";

export type Product = {
  id: string;
  name: string;
  spec: string | null;
  unit: string;
  price_kzt: number;
  in_stock: boolean;
  lead_time_days: number | null;
  price_tiers: { min_qty: number; price_kzt: number }[];
};

export type CatalogResult =
  | { status: "ok"; products: Product[] }
  | { status: "not_configured" }
  | { status: "login_required" }
  | { status: "error"; message: string };

/** Products are readable only by signed-in users (RLS), matching "цены после входа по БИН". */
export async function listProducts(opts: { categorySlug?: string; q?: string }): Promise<CatalogResult> {
  const supabase = await getSupabase();
  if (!supabase) return { status: "not_configured" };

  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { status: "login_required" };

  let query = supabase
    .from("products")
    .select("id, name, spec, unit, price_kzt, in_stock, lead_time_days, price_tiers(min_qty, price_kzt), categories!inner(slug)")
    .eq("is_active", true)
    .order("in_stock", { ascending: false })
    .order("name")
    .limit(200);

  if (opts.categorySlug) query = query.eq("categories.slug", opts.categorySlug);
  if (opts.q) query = query.textSearch("search", opts.q, { type: "websearch", config: "russian" });

  const { data, error } = await query;
  if (error) return { status: "error", message: error.message };
  return { status: "ok", products: (data ?? []) as unknown as Product[] };
}
