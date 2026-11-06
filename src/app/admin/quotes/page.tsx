import Link from "next/link";
import { requireStaff } from "@/lib/staff";
import { formatDocDate } from "@/lib/documents";
import { formatTenge } from "@/lib/money";
import { orderStatuses } from "@/lib/order-statuses";

type Row = {
  id: string;
  number: string;
  created_at: string;
  total_kzt: number;
  delivery_method: string | null;
  delivery_kzt: number;
  companies: { name: string; legal_form: string | null; bin: string } | null;
  sellers: { code: string } | null;
  orders: { invoice_number: string | null; status: string }[] | { invoice_number: string | null; status: string } | null;
};

export default async function AdminQuotes() {
  const { supabase } = await requireStaff();
  const { data } = await supabase
    .from("quotes")
    .select("id, number, created_at, total_kzt, delivery_method, delivery_kzt, companies(name, legal_form, bin), sellers(code), orders(invoice_number, status)")
    .order("created_at", { ascending: false })
    .limit(200);

  const rows = (data ?? []) as unknown as Row[];
  return (
    <>
      <h1 className="font-display text-[28px] font-semibold">КП и счета</h1>
      {rows.length === 0 ? (
        <p className="card p-6 text-steel-500">КП пока нет. Они появятся, когда покупатели начнут оформлять корзину.</p>
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full min-w-[820px] border-collapse text-[15px]">
            <thead>
              <tr className="text-left text-[13px] text-muted-foreground">
                <th scope="col" className="px-5 py-3 font-medium">КП</th>
                <th scope="col" className="px-3 py-3 font-medium">Покупатель</th>
                <th scope="col" className="px-3 py-3 text-right font-medium">Сумма</th>
                <th scope="col" className="px-3 py-3 font-medium">Нужно сделать</th>
                <th scope="col" className="px-5 py-3 font-medium">Счёт</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((q) => {
                const order = Array.isArray(q.orders) ? q.orders[0] : q.orders;
                const st = order ? orderStatuses[order.status] : null;
                const needsDelivery = !order && q.delivery_method && q.delivery_method !== "pickup" && Number(q.delivery_kzt) === 0;
                return (
                  <tr key={q.id} className="border-t border-steel-100">
                    <td className="px-5 py-3.5">
                      <Link href={`/admin/quotes/${q.id}`} className="font-semibold underline-offset-4 hover:underline">{q.number}</Link>
                      <div className="text-[13px] text-muted-foreground">{formatDocDate(q.created_at)} · {q.sellers?.code === "bereke" ? "Bereke" : "AIMAG"}</div>
                    </td>
                    <td className="px-3 py-3.5">
                      {q.companies?.legal_form} {q.companies?.name}
                      <div className="text-[13px] text-muted-foreground">БИН {q.companies?.bin}</div>
                    </td>
                    <td className="whitespace-nowrap px-3 py-3.5 text-right tabular-nums">{formatTenge(Number(q.total_kzt))}</td>
                    <td className="px-3 py-3.5 text-sm">{needsDelivery ? <span className="badge bg-amber-50 text-amber-900">посчитать доставку</span> : "—"}</td>
                    <td className="px-5 py-3.5">
                      {order && st ? (
                        <span className={`badge ${st.cls}`}>№ {order.invoice_number} · {st.label}</span>
                      ) : (
                        <span className="text-sm text-muted-foreground">не выставлен</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
