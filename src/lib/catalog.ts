import "server-only";
import { getSupabase } from "@/lib/supabase/server";
import { categories as staticCategories } from "@/config/site";
import {
  skuMatches,
  type CatalogAttr,
  type CatalogGroup,
  type CategoryNode,
  type Filters,
  type Sku,
} from "@/lib/catalog-types";

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

/** Flat product search (catalog ?q=). Products are readable only by signed-in users (RLS). */
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

// ── Category page: subsections, filters, groups with variants ──────────

export type CategoryPage = {
  status: "ok" | "not_configured" | "error";
  category: CategoryNode;
  parent: CategoryNode | null;
  children: CategoryNode[];
  siblings: CategoryNode[]; // other subsections of the parent (for a subsection page)
  attrs: CatalogAttr[]; // filters/variant axes of this subsection (empty for a top section)
  groups: CatalogGroup[];
  loose: Product[]; // products without a group (legacy flat items)
  signedIn: boolean;
  error?: string;
};

type Row = Record<string, unknown>;

function staticTree(): CategoryNode[] {
  return staticCategories.map((c, i) => ({ id: -(i + 1), parentId: null, slug: c.slug, name: c.name, sort: i + 1 }));
}

export async function getCategoryTree(): Promise<CategoryNode[]> {
  const supabase = await getSupabase();
  if (!supabase) return staticTree();
  const { data, error } = await supabase.from("categories").select("id, parent_id, slug, name, sort").order("sort");
  if (error || !data?.length) return staticTree();
  return (data as Row[]).map((r) => ({
    id: r.id as number,
    parentId: (r.parent_id as number | null) ?? null,
    slug: r.slug as string,
    name: r.name as string,
    sort: r.sort as number,
  }));
}

export async function getCategoryPage(slug: string, filters: Filters): Promise<CategoryPage | null> {
  const tree = await getCategoryTree();
  const category = tree.find((c) => c.slug === slug);
  if (!category) return null;
  const parent = category.parentId ? (tree.find((c) => c.id === category.parentId) ?? null) : null;
  const children = tree.filter((c) => c.parentId === category.id).sort((a, b) => a.sort - b.sort);
  const siblings = parent ? tree.filter((c) => c.parentId === parent.id).sort((a, b) => a.sort - b.sort) : [];
  const base = { category, parent, children, siblings, attrs: [], groups: [], loose: [], signedIn: false };

  const supabase = await getSupabase();
  if (!supabase || category.id < 0) return { ...base, status: "not_configured" };

  const subtreeIds = [category.id, ...children.map((c) => c.id)];
  const nameById = new Map(tree.map((c) => [c.id, c.name]));
  const { data: auth } = await supabase.auth.getUser();
  const signedIn = Boolean(auth.user);

  const [attrsRes, groupsRes, productsRes] = await Promise.all([
    supabase
      .from("category_attributes")
      .select("is_filter, is_variant, sort, attributes(code, name, unit, kind, attribute_options(value, label, hex, sort))")
      .eq("category_id", category.id)
      .order("sort"),
    supabase
      .from("product_groups")
      .select("id, name, description, category_id, sort")
      .in("category_id", subtreeIds)
      .eq("is_active", true)
      .order("sort")
      .order("name"),
    signedIn
      ? supabase
          .from("products")
          .select(
            "id, name, spec, unit, price_kzt, in_stock, lead_time_days, group_id, price_tiers(min_qty, price_kzt), product_attributes(value, attributes(code))",
          )
          .in("category_id", subtreeIds)
          .eq("is_active", true)
          .order("name")
          .limit(1000)
      : Promise.resolve({ data: [] as Row[], error: null }),
  ]);

  const err = attrsRes.error ?? groupsRes.error ?? productsRes.error;
  if (err) return { ...base, signedIn, status: "error", error: err.message };

  const attrs: CatalogAttr[] = ((attrsRes.data ?? []) as Row[]).flatMap((r) => {
    const a = (Array.isArray(r.attributes) ? r.attributes[0] : r.attributes) as Row | null;
    if (!a) return [];
    const options = ((a.attribute_options as Row[]) ?? [])
      .sort((x, y) => (x.sort as number) - (y.sort as number))
      .map((o) => ({ value: o.value as string, label: o.label as string, hex: (o.hex as string | null) ?? null }));
    return [
      {
        code: a.code as string,
        name: a.name as string,
        unit: (a.unit as string | null) ?? null,
        kind: a.kind as "enum" | "color",
        isFilter: Boolean(r.is_filter),
        isVariant: Boolean(r.is_variant),
        options,
      },
    ];
  });

  const skusByGroup = new Map<string, Sku[]>();
  const loose: Product[] = [];
  for (const p of (productsRes.data ?? []) as Row[]) {
    const attrsMap: Record<string, string> = {};
    for (const pa of (p.product_attributes as Row[]) ?? []) {
      const a = (Array.isArray(pa.attributes) ? pa.attributes[0] : pa.attributes) as Row | null;
      if (a) attrsMap[a.code as string] = pa.value as string;
    }
    const tiers = ((p.price_tiers as Row[]) ?? []).map((t) => ({ minQty: Number(t.min_qty), priceKzt: Number(t.price_kzt) }));
    const sku: Sku = {
      id: p.id as string,
      name: p.name as string,
      spec: (p.spec as string | null) ?? null,
      unit: p.unit as string,
      priceKzt: Number(p.price_kzt),
      inStock: Boolean(p.in_stock),
      leadTimeDays: (p.lead_time_days as number | null) ?? null,
      tiers,
      attrs: attrsMap,
    };
    if (!skuMatches(sku, filters)) continue;
    if (p.group_id) {
      const list = skusByGroup.get(p.group_id as string) ?? [];
      list.push(sku);
      skusByGroup.set(p.group_id as string, list);
    } else {
      loose.push({
        id: sku.id,
        name: sku.name,
        spec: sku.spec,
        unit: sku.unit,
        price_kzt: sku.priceKzt,
        in_stock: sku.inStock,
        lead_time_days: sku.leadTimeDays,
        price_tiers: tiers.map((t) => ({ min_qty: t.minQty, price_kzt: t.priceKzt })),
      });
    }
  }

  const hasFilters = Object.keys(filters).length > 0;
  const groups: CatalogGroup[] = ((groupsRes.data ?? []) as Row[])
    .map((g) => ({
      id: g.id as string,
      name: g.name as string,
      description: (g.description as string | null) ?? null,
      categoryName: nameById.get(g.category_id as number) ?? "",
      skus: skusByGroup.get(g.id as string) ?? [],
    }))
    // with filters on, hide groups that have no matching variant (guests see all — no variant data)
    .filter((g) => !signedIn || !hasFilters || g.skus.length > 0);

  return { ...base, status: "ok", signedIn, attrs, groups, loose };
}
