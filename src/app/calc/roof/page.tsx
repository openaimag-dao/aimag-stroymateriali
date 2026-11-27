import type { Metadata } from "next";
import { getSupabase } from "@/lib/supabase/server";
import { getCategoryTree } from "@/lib/catalog";
import type { CalcProduct } from "@/lib/roof-calc";
import { RoofCalculator } from "@/components/calc/roof-calculator";

export const metadata: Metadata = {
  title: "Калькулятор кровли — металлочерепица и профнастил",
  description:
    "Рассчитайте металлочерепицу или профнастил, конёк, мембрану, саморезы и водосток по размерам дома. Цены с НДС, оптом в Шымкенте.",
  alternates: { canonical: "/calc/roof" },
};
export const dynamic = "force-dynamic";

const SLUGS = ["metal-tile", "profnastil", "roof-extras", "roof-membranes", "roof-fasteners", "gutters"];

async function loadProducts(): Promise<CalcProduct[]> {
  const supabase = await getSupabase();
  if (!supabase) return [];
  const tree = await getCategoryTree();
  const results = await Promise.all(
    SLUGS.map(async (slug) => {
      const cat = tree.find((c) => c.slug === slug);
      if (!cat) return [];
      const { data, error } = await supabase.rpc("catalog_products_public", { p_category_ids: [cat.id] });
      if (error || !data) return [];
      return (data as { id: string; name: string; unit: string; price_kzt: number | string; attrs: Record<string, string> | null }[]).map(
        (r): CalcProduct => ({
          id: r.id,
          name: r.name,
          unit: r.unit,
          priceKzt: Number(r.price_kzt),
          categorySlug: slug,
          attrs: r.attrs ?? {},
        }),
      );
    }),
  );
  return results.flat();
}

export default async function RoofCalcPage() {
  const products = await loadProducts();
  return (
    <div className="container flex flex-col gap-6 py-8">
      <div className="flex max-w-[760px] flex-col gap-2.5">
        <h1 className="font-display text-[34px] font-semibold tracking-tight">Калькулятор кровли</h1>
        <p className="text-[17px] leading-relaxed text-steel-500">
          Укажите размеры дома и уклон. Посчитаем покрытие, конёк, мембрану, саморезы и водосток. Весь список можно сразу положить в
          корзину. Точный раскрой листов сделает менеджер в КП.
        </p>
      </div>
      <RoofCalculator products={products} />
    </div>
  );
}
