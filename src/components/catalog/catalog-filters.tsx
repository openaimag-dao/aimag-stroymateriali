import Link from "next/link";
import type { CatalogAttr, Filters } from "@/lib/catalog-types";

/** Plain GET form: works without JavaScript, the URL keeps the filters (?f.ral=RAL3005&f.thickness=0.50). */
export function CatalogFilters({ action, attrs, filters }: { action: string; attrs: CatalogAttr[]; filters: Filters }) {
  const shown = attrs.filter((a) => a.isFilter && a.options.length > 0);
  if (shown.length === 0) return null;
  const active = Object.values(filters).reduce((n, v) => n + v.length, 0);

  return (
    <form action={action} method="get" aria-label="Фильтры" className="card flex flex-col gap-5 p-5">
      {shown.map((a) => (
        <fieldset key={a.code} className="flex flex-col gap-2">
          <legend className="mb-2 text-[15px] font-semibold">{a.name}</legend>
          {a.kind === "color" ? (
            <div className="flex flex-wrap gap-2">
              {a.options.map((o) => (
                <label key={o.value} title={o.label} className="relative cursor-pointer">
                  <input
                    type="checkbox"
                    name={`f.${a.code}`}
                    value={o.value}
                    defaultChecked={filters[a.code]?.includes(o.value)}
                    className="peer sr-only"
                  />
                  <span className="sr-only">{o.label}</span>
                  <span
                    aria-hidden="true"
                    className="block h-9 w-9 rounded-lg border-2 border-steel-200 peer-checked:border-signal peer-checked:ring-2 peer-checked:ring-signal peer-focus-visible:ring-2 peer-focus-visible:ring-signal"
                    style={{ backgroundColor: o.hex ?? "#E4E9F0" }}
                  />
                </label>
              ))}
            </div>
          ) : (
            a.options.map((o) => (
              <label key={o.value} className="flex min-h-[28px] items-center gap-2.5 text-[15px]">
                <input
                  type="checkbox"
                  name={`f.${a.code}`}
                  value={o.value}
                  defaultChecked={filters[a.code]?.includes(o.value)}
                  className="h-[18px] w-[18px] accent-steel-900"
                />
                {o.label}
              </label>
            ))
          )}
        </fieldset>
      ))}
      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" className="btn-dark">Показать</button>
        {active > 0 && (
          <Link href={action} className="text-sm font-semibold underline">
            Сбросить ({active})
          </Link>
        )}
      </div>
    </form>
  );
}
