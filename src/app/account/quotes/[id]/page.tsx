import Link from "next/link";
import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { FileDown, Receipt } from "lucide-react";
import { getUser } from "@/lib/supabase/server";
import { deliveryLabel, documentErrorText, formatDocDate, getQuoteDoc } from "@/lib/documents";
import { formatTenge } from "@/lib/money";
import { siteConfig } from "@/config/site";
import { issueInvoice } from "./actions";

export const metadata: Metadata = { title: "Коммерческое предложение" };
export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }>; searchParams: Promise<{ invoice_error?: string }> };

export default async function QuotePage({ params, searchParams }: Props) {
  const { id } = await params;
  const { invoice_error } = await searchParams;
  if (!(await getUser())) redirect(`/login?next=/account/quotes/${id}`);
  const doc = await getQuoteDoc(id);
  if (!doc) notFound();

  const expired = doc.valid_until < new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Almaty" });
  const issue = issueInvoice.bind(null, doc.id);

  return (
    <div className="container flex flex-col gap-5 py-8">
      <nav aria-label="Хлебные крошки" className="text-sm text-muted-foreground">
        <Link href="/account">Кабинет</Link> / КП № {doc.number}
      </nav>

      <section className="card flex flex-wrap items-start justify-between gap-4 p-6">
        <div className="flex flex-col gap-1">
          <h1 className="font-display text-[26px] font-semibold">КП № {doc.number}</h1>
          <p className="text-sm text-muted-foreground">
            от {formatDocDate(doc.created_at)} · {expired ? "срок действия истёк" : `действительно до ${formatDocDate(doc.valid_until)}`}
          </p>
          <p className="text-sm text-muted-foreground">{deliveryLabel[doc.delivery_method ?? "pickup"]}</p>
        </div>
        <div className="flex flex-wrap gap-2.5">
          <a href={`/api/documents/quote/${doc.id}`} target="_blank" rel="noopener" className="btn-outline">
            <FileDown className="h-[18px] w-[18px]" aria-hidden="true" /> КП в PDF
          </a>
          {doc.order?.invoice_number ? (
            <a href={`/api/documents/invoice/${doc.order.id}`} target="_blank" rel="noopener" className="btn-signal">
              <Receipt className="h-[18px] w-[18px]" aria-hidden="true" /> Счёт № {doc.order.invoice_number} в PDF
            </a>
          ) : !expired ? (
            <form action={issue}>
              <button type="submit" className="btn-signal">
                <Receipt className="h-[18px] w-[18px]" aria-hidden="true" /> Выставить счёт
              </button>
            </form>
          ) : (
            <Link href="/catalog" className="btn-signal">Собрать новый заказ</Link>
          )}
        </div>
      </section>

      {invoice_error && !doc.order && (
        <p role="alert" className="rounded-lg bg-amber-50 p-4 text-sm text-amber-900">
          {documentErrorText(invoice_error)} Телефон: <a href={siteConfig.phoneHref} className="font-semibold">{siteConfig.phone}</a>
        </p>
      )}

      <section aria-label="Позиции" className="card overflow-x-auto">
        <table className="w-full min-w-[720px] border-collapse text-[15px]">
          <thead>
            <tr className="text-left text-[13px] text-muted-foreground">
              <th scope="col" className="px-6 py-3 font-medium">№</th>
              <th scope="col" className="px-3 py-3 font-medium">Наименование</th>
              <th scope="col" className="px-3 py-3 text-right font-medium">Кол-во</th>
              <th scope="col" className="px-3 py-3 text-right font-medium">Цена с НДС</th>
              <th scope="col" className="px-6 py-3 text-right font-medium">Сумма</th>
            </tr>
          </thead>
          <tbody>
            {doc.lines.map((l) => (
              <tr key={l.line_no} className="border-t border-steel-100">
                <td className="px-6 py-3.5">{l.line_no}</td>
                <td className="px-3 py-3.5">
                  <div className="font-semibold">{l.name}</div>
                  {l.mark && <div className="text-[13px] text-muted-foreground">{l.mark}</div>}
                </td>
                <td className="whitespace-nowrap px-3 py-3.5 text-right">{l.qty} {l.unit}</td>
                <td className="whitespace-nowrap px-3 py-3.5 text-right tabular-nums">{formatTenge(l.price_kzt)}</td>
                <td className="whitespace-nowrap px-6 py-3.5 text-right font-semibold tabular-nums">{formatTenge(Math.round(l.qty * l.price_kzt))}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <dl className="ml-auto flex max-w-sm flex-col gap-2 border-t px-6 py-4 text-[15px] tabular-nums">
          <div className="flex justify-between text-lg font-bold">
            <dt>Итого с НДС</dt>
            <dd>{formatTenge(doc.total_kzt)}</dd>
          </div>
          <div className="flex justify-between text-muted-foreground">
            <dt>в т.ч. НДС 16%</dt>
            <dd>{formatTenge(doc.vat_kzt)}</dd>
          </div>
        </dl>
      </section>
    </div>
  );
}
