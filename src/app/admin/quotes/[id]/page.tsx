import Link from "next/link";
import { notFound } from "next/navigation";
import { requireStaff } from "@/lib/staff";
import { deliveryLabel, formatDocDate, getQuoteDoc } from "@/lib/documents";
import { formatTenge } from "@/lib/money";
import { orderStatuses } from "@/lib/order-statuses";
import { setOrderStatus, staffIssueInvoice, updateQuote } from "./actions";

type Props = { params: Promise<{ id: string }>; searchParams: Promise<{ msg?: string }> };

export default async function AdminQuote({ params, searchParams }: Props) {
  const { id } = await params;
  const { msg } = await searchParams;
  const { supabase } = await requireStaff();
  const doc = await getQuoteDoc(id);
  if (!doc) notFound();
  const { data: q } = await supabase.from("quotes").select("sellers(code)").eq("id", id).maybeSingle();
  const sellerRel = q?.sellers as { code: string } | { code: string }[] | null | undefined;
  const sellerCode = (Array.isArray(sellerRel) ? sellerRel[0]?.code : sellerRel?.code) ?? "aimag";
  const order = doc.order;

  return (
    <>
      <nav aria-label="Хлебные крошки" className="text-sm text-muted-foreground">
        <Link href="/admin/quotes">КП и счета</Link> / {doc.number}
      </nav>
      <section className="card flex flex-wrap items-start justify-between gap-4 p-5">
        <div className="flex flex-col gap-1">
          <h1 className="font-display text-[26px] font-semibold">КП № {doc.number}</h1>
          <p className="text-sm text-muted-foreground">
            {formatDocDate(doc.created_at)} · до {formatDocDate(doc.valid_until)} · {doc.company.legal_form} «{doc.company.name}», БИН {doc.company.bin}
          </p>
          <p className="text-sm text-muted-foreground">
            {deliveryLabel[doc.delivery_method ?? "pickup"]}
            {doc.delivery_city || doc.delivery_address ? `: ${[doc.delivery_city, doc.delivery_address].filter(Boolean).join(", ")}` : ""}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <a href={`/api/documents/quote/${doc.id}`} target="_blank" rel="noopener" className="btn-outline">КП PDF</a>
          {order?.invoice_number && (
            <a href={`/api/documents/invoice/${order.id}`} target="_blank" rel="noopener" className="btn-outline">Счёт PDF</a>
          )}
        </div>
      </section>
      {msg && <p role="status" className="rounded-lg bg-steel-100 p-3 text-sm">{msg}</p>}

      {!order ? (
        <section className="card flex flex-col gap-4 p-5">
          <h2 className="text-lg font-semibold">До выставления счёта</h2>
          <form action={updateQuote.bind(null, doc.id)} className="flex flex-wrap items-end gap-3">
            <label className="flex flex-col gap-1.5 text-sm font-medium">
              Доставка, ₸ с НДС
              <input name="delivery_kzt" inputMode="decimal" defaultValue={String(doc.delivery_kzt)} className="field w-44" />
            </label>
            <label className="flex flex-col gap-1.5 text-sm font-medium">
              Продавец в документах
              <select name="seller" defaultValue={sellerCode} className="field w-52">
                <option value="aimag">ИП AIMAG</option>
                <option value="bereke">ЖК Bereke</option>
              </select>
            </label>
            <button type="submit" className="btn-dark">Сохранить</button>
          </form>
          <form action={staffIssueInvoice.bind(null, doc.id)}>
            <button type="submit" className="btn-signal">Выставить счёт</button>
          </form>
        </section>
      ) : (
        <section className="card flex flex-wrap items-end justify-between gap-4 p-5">
          <div>
            <h2 className="text-lg font-semibold">Счёт № {order.invoice_number}</h2>
            <p className="text-sm text-muted-foreground">от {formatDocDate(order.created_at)} · {formatTenge(order.total_kzt)}</p>
          </div>
          <form action={setOrderStatus.bind(null, doc.id, order.id)} className="flex flex-wrap items-end gap-3">
            <label className="flex flex-col gap-1.5 text-sm font-medium">
              Статус
              <select name="status" defaultValue={order.status} className="field w-52">
                {Object.entries(orderStatuses).map(([k, v]) => (
                  <option key={k} value={k}>{v.label}</option>
                ))}
              </select>
            </label>
            <button type="submit" className="btn-dark">Обновить</button>
          </form>
        </section>
      )}

      <section aria-label="Позиции" className="card overflow-x-auto">
        <table className="w-full min-w-[680px] border-collapse text-[15px]">
          <thead>
            <tr className="text-left text-[13px] text-muted-foreground">
              <th scope="col" className="px-5 py-3 font-medium">№</th>
              <th scope="col" className="px-3 py-3 font-medium">Наименование</th>
              <th scope="col" className="px-3 py-3 text-right font-medium">Кол-во</th>
              <th scope="col" className="px-3 py-3 text-right font-medium">Цена</th>
              <th scope="col" className="px-5 py-3 text-right font-medium">Сумма</th>
            </tr>
          </thead>
          <tbody>
            {doc.lines.map((l) => (
              <tr key={l.line_no} className="border-t border-steel-100">
                <td className="px-5 py-3">{l.line_no}</td>
                <td className="px-3 py-3">{l.name}{l.mark ? <span className="text-muted-foreground">, {l.mark}</span> : null}</td>
                <td className="whitespace-nowrap px-3 py-3 text-right">{l.qty} {l.unit}</td>
                <td className="whitespace-nowrap px-3 py-3 text-right tabular-nums">{formatTenge(l.price_kzt)}</td>
                <td className="whitespace-nowrap px-5 py-3 text-right tabular-nums">{formatTenge(Math.round(l.qty * l.price_kzt))}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <dl className="ml-auto flex max-w-sm flex-col gap-1.5 border-t px-5 py-4 text-[15px] tabular-nums">
          <div className="flex justify-between"><dt className="text-muted-foreground">Товары</dt><dd>{formatTenge(doc.goods_kzt)}</dd></div>
          <div className="flex justify-between"><dt className="text-muted-foreground">Доставка</dt><dd>{formatTenge(doc.delivery_kzt)}</dd></div>
          <div className="flex justify-between text-lg font-bold"><dt>Итого с НДС</dt><dd>{formatTenge(doc.total_kzt)}</dd></div>
          <div className="flex justify-between text-muted-foreground"><dt>в т.ч. НДС 16%</dt><dd>{formatTenge(doc.vat_kzt)}</dd></div>
        </dl>
      </section>
    </>
  );
}
