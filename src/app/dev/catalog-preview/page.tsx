import { notFound } from "next/navigation";
import { GroupCard } from "@/components/catalog/group-card";
import { CatalogFilters } from "@/components/catalog/catalog-filters";
import type { CatalogAttr, CatalogGroup, Sku } from "@/lib/catalog-types";

// Только для разработки: вид карточек и фильтров на демо-данных, без базы.
export const dynamic = "force-dynamic";

const RAL: [string, string, string][] = [
  ["RAL3005", "RAL 3005 Красное вино", "#5E2129"],
  ["RAL3011", "RAL 3011 Коричнево-красный", "#792423"],
  ["RAL5005", "RAL 5005 Сигнальный синий", "#154889"],
  ["RAL6005", "RAL 6005 Зелёный мох", "#2F4538"],
  ["RAL7024", "RAL 7024 Графитовый серый", "#474A51"],
  ["RAL8017", "RAL 8017 Шоколадно-коричневый", "#45322E"],
  ["RAL9003", "RAL 9003 Сигнальный белый", "#F4F4F4"],
];

const roofAttrs: CatalogAttr[] = [
  { code: "proflist_profile", name: "Профиль", unit: null, kind: "enum", isFilter: true, isVariant: true,
    options: [["c8", "С8"], ["c10", "С10"], ["c20", "С20"], ["c21", "С21"], ["ns35", "НС35"]].map(([value, label]) => ({ value, label, hex: null })) },
  { code: "thickness", name: "Толщина металла", unit: "мм", kind: "enum", isFilter: true, isVariant: true,
    options: [["0.45", "0,45 мм"], ["0.50", "0,50 мм"], ["0.55", "0,55 мм"]].map(([value, label]) => ({ value, label, hex: null })) },
  { code: "coating", name: "Покрытие", unit: null, kind: "enum", isFilter: true, isVariant: true,
    options: [["zinc", "Оцинковка"], ["pe", "Полиэстер"], ["mpe", "Матовый полиэстер"]].map(([value, label]) => ({ value, label, hex: null })) },
  { code: "ral", name: "Цвет", unit: null, kind: "color", isFilter: true, isVariant: true,
    options: RAL.map(([value, label, hex]) => ({ value, label, hex })) },
];

const fitAttrs: CatalogAttr[] = [
  { code: "fitting_type", name: "Тип", unit: null, kind: "enum", isFilter: true, isVariant: true,
    options: [["coupling", "Муфта"], ["elbow90", "Угольник 90°"], ["tee", "Тройник"], ["female", "Муфта комбинированная ВР"]].map(([value, label]) => ({ value, label, hex: null })) },
  { code: "pipe_diameter", name: "Диаметр", unit: "мм", kind: "enum", isFilter: true, isVariant: true,
    options: ["20", "25", "32", "40"].map((v) => ({ value: v, label: `${v} мм`, hex: null })) },
  { code: "thread", name: "Резьба", unit: null, kind: "enum", isFilter: true, isVariant: true,
    options: [["1/2", "1/2″"], ["3/4", "3/4″"]].map(([value, label]) => ({ value, label, hex: null })) },
];

let n = 0;
const sku = (name: string, unit: string, priceKzt: number, attrs: Record<string, string>, inStock = true): Sku => ({
  id: `00000000-0000-0000-0000-${String(++n).padStart(12, "0")}`, name, spec: null, unit, priceKzt, inStock,
  leadTimeDays: inStock ? null : 7, tiers: priceKzt > 2000 ? [{ minQty: 300, priceKzt: priceKzt - 170 }] : [], attrs,
});

const c21: Sku[] = [];
for (const [t, base] of [["0.45", 2890], ["0.50", 3270], ["0.55", 3640]] as const) {
  for (const [code] of RAL) c21.push(sku(`Профнастил С21 ${t.replace(".", ",")} мм ${code}`, "м²", base + 190, { proflist_profile: "c21", thickness: t, coating: "pe", ral: code }, code !== "RAL5005"));
  c21.push(sku(`Профнастил С21 ${t.replace(".", ",")} мм оцинк.`, "м²", base, { proflist_profile: "c21", thickness: t, coating: "zinc" }));
}

const fittings: Sku[] = [
  ...["20", "25", "32", "40"].map((d, i) => sku(`Муфта PP-R ${d} мм`, "шт", 60 + i * 35, { fitting_type: "coupling", pipe_diameter: d })),
  ...["20", "25", "32"].map((d, i) => sku(`Угольник PP-R 90° ${d} мм`, "шт", 75 + i * 40, { fitting_type: "elbow90", pipe_diameter: d })),
  ...["20", "25"].map((d, i) => sku(`Тройник PP-R ${d} мм`, "шт", 90 + i * 45, { fitting_type: "tee", pipe_diameter: d })),
  sku("Муфта комб. PP-R 20×1/2″ ВР", "шт", 640, { fitting_type: "female", pipe_diameter: "20", thread: "1/2" }),
  sku("Муфта комб. PP-R 25×3/4″ ВР", "шт", 890, { fitting_type: "female", pipe_diameter: "25", thread: "3/4" }, false),
];

const groups: { g: CatalogGroup; attrs: CatalogAttr[] }[] = [
  { g: { id: "g1", name: "Профнастил С21", description: "Стеновой и кровельный, ширина полезная 1000 мм. Нарезка в размер.", categoryName: "Профнастил", skus: c21 }, attrs: roofAttrs },
  { g: { id: "g2", name: "Фитинги PP-R для водопровода", description: "Под сварку, PN25. Белые.", categoryName: "Фитинги PP-R", skus: fittings }, attrs: fitAttrs },
  { g: { id: "g3", name: "Металлочерепица Монтеррей", description: null, categoryName: "Металлочерепица", skus: [] }, attrs: roofAttrs },
];

export default function CatalogPreview() {
  if (process.env.NODE_ENV === "production") notFound();
  return (
    <div className="container py-7">
      <p className="mb-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">Демо-данные для проверки вида. Цены вымышленные.</p>
      <div className="flex flex-wrap items-start gap-6">
        <aside className="max-w-full flex-[1_1_260px]">
          <CatalogFilters action="/dev/catalog-preview" attrs={roofAttrs} filters={{ thickness: ["0.50"] }} />
        </aside>
        <section className="grid min-w-0 flex-[999_1_640px] grid-cols-[repeat(auto-fill,minmax(min(100%,420px),1fr))] gap-4">
          {groups.map(({ g, attrs }) => (
            <GroupCard key={g.id} group={g} attrs={attrs} signedIn={g.id !== "g3"} />
          ))}
          <GroupCard group={{ ...groups[0].g, id: "g4", skus: [] }} attrs={roofAttrs} signedIn={false} />
        </section>
      </div>
    </div>
  );
}
