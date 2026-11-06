import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { ImportContext } from "@/lib/price-import";

type Row = Record<string, unknown>;

/** Categories with their characteristics and the latest RUB/CNY rates — everything the price parser needs. */
export async function loadImportContext(supabase: SupabaseClient): Promise<ImportContext> {
  const [cats, links, rates] = await Promise.all([
    supabase.from("categories").select("id, slug, name, markup_pct"),
    supabase.from("category_attributes").select("category_id, attributes(id, code, name, attribute_options(value, label))"),
    supabase.from("exchange_rates").select("currency, rate_date, kzt_per_unit").order("rate_date", { ascending: false }).limit(50),
  ]);
  const err = cats.error ?? links.error ?? rates.error;
  if (err) throw new Error(err.message);

  const attrsByCat = new Map<number, ImportContext["categories"][number]["attrs"]>();
  for (const l of (links.data ?? []) as Row[]) {
    const a = (Array.isArray(l.attributes) ? l.attributes[0] : l.attributes) as Row | null;
    if (!a) continue;
    const list = attrsByCat.get(l.category_id as number) ?? [];
    list.push({
      id: a.id as number,
      code: a.code as string,
      name: a.name as string,
      options: ((a.attribute_options as Row[]) ?? []).map((o) => ({ value: o.value as string, label: o.label as string })),
    });
    attrsByCat.set(l.category_id as number, list);
  }

  const latest: Record<string, number> = {};
  for (const r of (rates.data ?? []) as Row[]) {
    const c = r.currency as string;
    if (latest[c] === undefined) latest[c] = Number(r.kzt_per_unit);
  }

  return {
    rates: latest,
    categories: ((cats.data ?? []) as Row[]).map((c) => ({
      id: c.id as number,
      slug: c.slug as string,
      name: c.name as string,
      markupPct: Number(c.markup_pct),
      attrs: attrsByCat.get(c.id as number) ?? [],
    })),
  };
}
