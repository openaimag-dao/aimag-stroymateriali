import Link from "next/link";
import { notFound } from "next/navigation";
import { requireStaff } from "@/lib/staff";
import { formatDocDate } from "@/lib/documents";
import { formatTenge } from "@/lib/money";
import { companyTitle } from "@/lib/company-title";
import { isSpecAiConfigured } from "@/lib/spec-ai/parse";
import { rerunSpecParse, saveAndCreateQuote, saveSpecItems } from "./actions";

export const dynamic = "force-dynamic";
// повторный разбор ИИ выполняется в этом запросе
export const maxDuration = 300;

type Props = { params: Promise<{ id: string }>; searchParams: Promise<{ msg?: string }> };

type Item = {
  line_no: number;
  source_text: string;
  name: string | null;
  qty: number | null;
  unit: string | null;
  product_id: string | null;
  match_status: string;
  confidence: number | null;
  note: string | null;
  candidates: string[];
};

type Product = { id: string; sku: string | null; name: string; unit: string; price_kzt: number; in_stock: boolean };

const matchLabels: Record<string, string> = {
  found: "Найдено",
  pending: "Не сопоставлено",
  to_order: "Под заказ",
  not_supplied: "Не поставляем",
};
const matchCls: Record<string, string> = {
  found: "bg-emerald-50 text-emerald-800",
  pending: "bg-amber-50 text-amber-900",
  to_order: "bg-blue-50 text-blue-800",
  not_supplied: "bg-steel-100 text-steel-600",
};
const aiLabels: Record<string, string> = {
  pending: "Разбирается…",
  done: "Разобрано ИИ",
  failed: "Ошибка разбора",
  skipped: "Без автоматического разбора",
};

export default async function AdminSpec({ params, searchParams }: Props) {
  const { id } = await params;
  const { msg } = await searchParams;
  const { supabase } = await requireStaff();
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();

  const { data: spec } = await supabase
    .from("specs")
    .select("id, file_name, file_path, status, ai_status, ai_error, ai_summary, ai_model, parsed_at, created_at, quote_id, companies(name, legal_form, bin), quotes(number)")
    .eq("id", id)
    .maybeSingle();
  if (!spec) notFound();

  const { data: itemRows } = await supabase
    .from("spec_items")
    .select("line_no, source_text, name, qty, unit, product_id, match_status, confidence, note, candidates")
    .eq("spec_id", id)
    .order("line_no");
  const items = ((itemRows ?? []) as Item[]).map((i) => ({ ...i, qty: i.qty === null ? null : Number(i.qty) }));

  const ids = [...new Set(items.flatMap((i) => [...(i.candidates ?? []), ...(i.product_id ? [i.product_id] : [])]))];
  const { data: prodRows } = ids.length
    ? await supabase.from("products").select("id, sku, name, unit, price_kzt, in_stock").in("id", ids)
    : { data: [] };
  const products = new Map(((prodRows ?? []) as Product[]).map((p) => [p.id, { ...p, price_kzt: Number(p.price_kzt) }]));

  const { data: signed } = await supabase.storage.from("specs").createSignedUrl(spec.file_path as string, 600, { download: true });
  const one = <T,>(v: T | T[] | null | undefined) => (Array.isArray(v) ? v[0] : v) ?? null;
  const company = one(spec.companies as unknown as { name: string; legal_form: string | null; bin: string } | null);
  const quote = one(spec.quotes as unknown as { number: string } | null);

  const found = items.filter((i) => i.match_status === "found");
  const goods = found.reduce((s, i) => {
    const p = i.product_id ? products.get(i.product_id) : undefined;
    return s + (p && i.qty ? Math.round(p.price_kzt * i.qty) : 0);
  }, 0);

  return (
    <>
      <nav aria-label="Хлебные крошки" className="text-sm text-muted-foreground">
        <Link href="/admin/specs">Спецификации</Link> / {spec.file_name as string}
      </nav>

      <section className="card flex flex-wrap items-start justify-between gap-4 p-5">
        <div className="flex min-w-0 flex-col gap-1">
          <h1 className="break-all font-display text-[24px] font-semibold">{spec.file_name as string}</h1>
          <p className="text-sm text-muted-foreground">
            {company ? `${companyTitle(company)}, БИН ${company.bin}` : "—"} · получена {formatDocDate(spec.created_at as string)}{" "}
            {new Date(spec.created_at as string).toLocaleTimeString("ru-RU", { timeZone: "Asia/Almaty", hour: "2-digit", minute: "2-digit" })}
          </p>
          <p className="text-sm">
            <b>{aiLabels[spec.ai_status as string] ?? spec.ai_status}</b>
            {spec.parsed_at ? ` · ${new Date(spec.parsed_at as string).toLocaleString("ru-RU", { timeZone: "Asia/Almaty" })}` : ""}
            {spec.ai_error ? <span className="text-amber-800"> · {spec.ai_error as string}</span> : null}
          </p>
          {spec.ai_summary ? <p className="max-w-3xl text-sm text-steel-600">Из заявки: {spec.ai_summary as string}</p> : null}
          {quote && spec.quote_id ? (
            <p className="text-sm">
              КП: <Link href={`/admin/quotes/${spec.quote_id as string}`} className="font-semibold underline">{quote.number}</Link>
            </p>
          ) : null}
        </div>
        <div className="flex flex-wrap gap-2">
          {signed?.signedUrl && <a href={signed.signedUrl} className="btn-outline">Скачать файл</a>}
          <form action={rerunSpecParse.bind(null, id)}>
            <button type="submit" className="btn-outline" disabled={!isSpecAiConfigured()} title={isSpecAiConfigured() ? "Позиции и правки будут заменены" : "Нужен ANTHROPIC_API_KEY"}>
              Разобрать заново
            </button>
          </form>
        </div>
      </section>

      {msg && <p role="status" className="rounded-lg bg-steel-100 p-3 text-sm">{msg}</p>}

      {items.length === 0 ? (
        <p className="card p-6 text-steel-500">
          {spec.ai_status === "pending"
            ? "ИИ разбирает заявку — обычно 1–3 минуты. Обновите страницу."
            : "Позиций нет. Разберите заявку вручную по файлу или запустите разбор заново."}
        </p>
      ) : (
        <form action={saveSpecItems.bind(null, id)} className="flex flex-col gap-4">
          <div className="card overflow-x-auto">
            <table className="w-full min-w-[1080px] border-collapse text-[14px]">
              <thead>
                <tr className="text-left text-[13px] text-muted-foreground">
                  <th scope="col" className="px-4 py-3 font-medium">№</th>
                  <th scope="col" className="px-3 py-3 font-medium">Из заявки</th>
                  <th scope="col" className="px-3 py-3 font-medium">Товар каталога</th>
                  <th scope="col" className="px-3 py-3 font-medium">Кол-во</th>
                  <th scope="col" className="px-4 py-3 font-medium">Статус</th>
                </tr>
              </thead>
              <tbody>
                {items.map((i) => {
                  const options = [...new Set([...(i.product_id ? [i.product_id] : []), ...(i.candidates ?? [])])]
                    .map((pid) => products.get(pid))
                    .filter((p): p is Product => Boolean(p));
                  const current = i.product_id ? products.get(i.product_id) : undefined;
                  return (
                    <tr key={i.line_no} className="border-t border-steel-100 align-top">
                      <td className="px-4 py-3">{i.line_no}</td>
                      <td className="max-w-[300px] px-3 py-3">
                        <div>{i.source_text}</div>
                        {i.name && i.name !== i.source_text ? <div className="text-[13px] text-muted-foreground">ИИ: {i.name}</div> : null}
                        {i.note ? <div className="mt-1 text-[13px] text-amber-800">{i.note}</div> : null}
                      </td>
                      <td className="px-3 py-3">
                        <label className="sr-only" htmlFor={`p-${i.line_no}`}>Товар для позиции {i.line_no}</label>
                        <select id={`p-${i.line_no}`} name={`product_${i.line_no}`} defaultValue={i.product_id ?? ""} className="field h-9 w-[380px] max-w-full text-[14px]">
                          <option value="">— не выбран —</option>
                          {options.map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.name} · {formatTenge(p.price_kzt)}/{p.unit}{p.in_stock ? "" : " · под заказ"}
                            </option>
                          ))}
                        </select>
                        <div className="mt-1.5 flex items-center gap-2 text-[13px] text-muted-foreground">
                          <label htmlFor={`s-${i.line_no}`}>или артикул</label>
                          <input id={`s-${i.line_no}`} name={`sku_${i.line_no}`} className="field h-8 w-36 text-[13px]" />
                          {i.confidence !== null && current ? <span>уверенность {Math.round(Number(i.confidence) * 100)}%</span> : null}
                        </div>
                      </td>
                      <td className="whitespace-nowrap px-3 py-3">
                        <label className="sr-only" htmlFor={`q-${i.line_no}`}>Количество для позиции {i.line_no}</label>
                        <input
                          id={`q-${i.line_no}`}
                          name={`qty_${i.line_no}`}
                          inputMode="decimal"
                          defaultValue={i.qty ?? ""}
                          className="field h-9 w-24 text-[14px]"
                        />{" "}
                        <span className="text-[13px] text-muted-foreground">{current?.unit ?? i.unit ?? ""}</span>
                        {current && i.unit && current.unit !== i.unit ? (
                          <div className="text-[12px] text-amber-800">в заявке: {i.unit}</div>
                        ) : null}
                      </td>
                      <td className="px-4 py-3">
                        <label className="sr-only" htmlFor={`st-${i.line_no}`}>Статус позиции {i.line_no}</label>
                        <select id={`st-${i.line_no}`} name={`status_${i.line_no}`} defaultValue={i.match_status} className={`field h-9 w-44 text-[14px] ${matchCls[i.match_status] ?? ""}`}>
                          {Object.entries(matchLabels).map(([k, v]) => (
                            <option key={k} value={k}>{v}</option>
                          ))}
                        </select>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="card flex flex-wrap items-center justify-between gap-3 p-5">
            <p className="text-sm text-muted-foreground">
              Найдено {found.length} из {items.length} · по базовым ценам ≈ {formatTenge(goods)} с НДС. В КП попадут позиции «Найдено» с
              количеством; оптовые цены и скидку компании посчитает база.
            </p>
            <div className="flex flex-wrap gap-2">
              <button type="submit" className="btn-outline">Сохранить</button>
              <button type="submit" formAction={saveAndCreateQuote.bind(null, id)} className="btn-signal">
                Сохранить и создать КП
              </button>
            </div>
          </div>
        </form>
      )}
    </>
  );
}
