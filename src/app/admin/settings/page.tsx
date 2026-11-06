import { requireStaff } from "@/lib/staff";
import { formatDocDate } from "@/lib/documents";
import { recalcPrices, saveMarkups, saveRates } from "./actions";

type Props = { searchParams: Promise<{ msg?: string }> };

export default async function SettingsPage({ searchParams }: Props) {
  const { msg } = await searchParams;
  const { supabase } = await requireStaff();
  const [rates, cats] = await Promise.all([
    supabase.from("exchange_rates").select("currency, rate_date, kzt_per_unit").order("rate_date", { ascending: false }).limit(20),
    supabase.from("categories").select("id, parent_id, name, markup_pct, sort").order("sort"),
  ]);
  const latest = (c: string) => rates.data?.find((r) => r.currency === c);
  const all = cats.data ?? [];
  const top = all.filter((c) => !c.parent_id);

  return (
    <>
      <h1 className="font-display text-[28px] font-semibold">Курс и наценки</h1>
      {msg && <p role="status" className="rounded-lg bg-steel-100 p-3 text-sm">{msg}</p>}

      <form action={saveRates} className="card flex flex-col gap-4 p-5">
        <h2 className="text-lg font-semibold">Курс Нацбанка РК на сегодня</h2>
        <div className="flex flex-wrap gap-4">
          {(["RUB", "CNY"] as const).map((c) => {
            const r = latest(c);
            return (
              <label key={c} className="flex flex-[1_1_200px] flex-col gap-1.5 text-sm font-medium">
                1 {c === "RUB" ? "рубль" : "юань"}, ₸
                <input name={c} inputMode="decimal" defaultValue={r ? String(r.kzt_per_unit) : ""} className="field" />
                <span className="text-xs font-normal text-muted-foreground">
                  {r ? `сейчас ${r.kzt_per_unit} ₸ от ${formatDocDate(r.rate_date)}` : "курс не задан — рублёвые позиции не посчитать"}
                </span>
              </label>
            );
          })}
        </div>
        <div>
          <button type="submit" className="btn-dark">Сохранить курс</button>
        </div>
      </form>

      <form action={saveMarkups} className="card flex flex-col gap-4 p-5">
        <h2 className="text-lg font-semibold">Наценки по разделам, %</h2>
        <p className="text-sm text-muted-foreground">Применяется к позициям прайса без своей наценки. Позиции с ручной ценой не меняются.</p>
        <div className="flex flex-col gap-4">
          {top.map((t) => (
            <fieldset key={t.id} className="flex flex-col gap-2">
              <legend className="mb-2 font-semibold">{t.name}</legend>
              <div className="grid grid-cols-[repeat(auto-fill,minmax(230px,1fr))] gap-2">
                {[t, ...all.filter((c) => c.parent_id === t.id)].map((c) => (
                  <label key={c.id} className="flex items-center justify-between gap-3 rounded-lg border px-3 py-1.5 text-sm">
                    <span>{c.id !== t.id ? c.name : all.some((x) => x.parent_id === t.id) ? "Позиции без подраздела" : "Наценка"}</span>
                    <input name={`m.${c.id}`} inputMode="decimal" defaultValue={String(c.markup_pct)} className="field h-9 w-20 text-right" aria-label={`Наценка: ${c.name}`} />
                  </label>
                ))}
              </div>
            </fieldset>
          ))}
        </div>
        <div>
          <button type="submit" className="btn-dark">Сохранить наценки</button>
        </div>
      </form>

      <form action={recalcPrices} className="card flex flex-wrap items-center justify-between gap-3 p-5">
        <p className="max-w-xl text-sm text-steel-700">
          Пересчитать цены всех позиций с закупочной ценой по последнему курсу и текущим наценкам. Уже выставленные КП и счета не меняются.
        </p>
        <button type="submit" className="btn-signal">Пересчитать цены</button>
      </form>
    </>
  );
}
