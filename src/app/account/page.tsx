import Link from "next/link";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSupabase } from "@/lib/supabase/server";
import { formatTenge } from "@/lib/money";
import { siteConfig } from "@/config/site";
import { RegisterCompanyForm } from "@/components/account/register-company-form";
import { signOut } from "./actions";

export const metadata: Metadata = { title: "Кабинет компании" };
export const dynamic = "force-dynamic";

const statuses: Record<string, { label: string; cls: string }> = {
  awaiting_payment: { label: "Ожидает оплаты", cls: "bg-amber-50 text-amber-900" },
  paid: { label: "Оплачен", cls: "bg-blue-50 text-blue-800" },
  shipped: { label: "Отгружен", cls: "bg-steel-100 text-steel-700" },
  delivered: { label: "Доставлен", cls: "bg-emerald-50 text-emerald-800" },
  cancelled: { label: "Отменён", cls: "bg-steel-50 text-steel-500" },
};

type OrderRow = {
  id: string;
  invoice_number: string | null;
  status: string;
  total_kzt: number;
  created_at: string;
  quotes: { number: string } | null;
};

export default async function AccountPage() {
  const supabase = await getSupabase();
  if (!supabase) redirect("/login");
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect("/login?next=/account");

  const { data: company } = await supabase
    .from("companies")
    .select("id, name, legal_form, bin, address")
    .limit(1)
    .maybeSingle();

  if (!company) {
    return (
      <div className="container max-w-[760px] py-10">
        <RegisterCompanyForm />
      </div>
    );
  }

  const { data: orders } = await supabase
    .from("orders")
    .select("id, invoice_number, status, total_kzt, created_at, quotes(number)")
    .eq("company_id", company.id)
    .order("created_at", { ascending: false })
    .limit(50);

  return (
    <div className="container flex flex-col gap-5 py-8">
      <section className="card flex flex-wrap items-center justify-between gap-4 p-6">
        <div className="flex flex-col gap-1">
          <h1 className="font-display text-[26px] font-semibold">
            {company.legal_form} «{company.name}»
          </h1>
          <span className="text-sm text-muted-foreground">
            БИН {company.bin} · ваш менеджер:{" "}
            <a href={siteConfig.phoneHref} className="font-semibold text-foreground">{siteConfig.phone}</a>
          </span>
        </div>
        <div className="flex flex-wrap gap-2.5">
          <Link href="/catalog" className="btn-signal">Новый заказ</Link>
          <form action={signOut}>
            <button type="submit" className="btn-outline">Выйти</button>
          </form>
        </div>
      </section>

      <section aria-labelledby="orders-h" className="card overflow-hidden">
        <h2 id="orders-h" className="px-6 pb-2 pt-5 text-[19px] font-semibold">Заказы и счета</h2>
        {!orders || orders.length === 0 ? (
          <p className="px-6 pb-6 text-steel-500">
            Заказов пока нет. Соберите корзину в <Link href="/catalog" className="font-semibold underline">каталоге</Link> или{" "}
            <Link href="/spec" className="font-semibold underline">загрузите спецификацию</Link>.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] border-collapse text-[15px]">
              <thead>
                <tr className="text-left text-[13px] text-muted-foreground">
                  <th scope="col" className="px-6 py-3 font-medium">Счёт / КП</th>
                  <th scope="col" className="px-3 py-3 font-medium">Дата</th>
                  <th scope="col" className="px-3 py-3 text-right font-medium">Сумма с НДС</th>
                  <th scope="col" className="px-6 py-3 font-medium">Статус</th>
                </tr>
              </thead>
              <tbody>
                {(orders as unknown as OrderRow[]).map((o) => {
                  const s = statuses[o.status] ?? statuses.awaiting_payment;
                  return (
                    <tr key={o.id} className="border-t border-steel-100">
                      <td className="px-6 py-4">
                        <div className="font-semibold">{o.invoice_number ? `Счёт № ${o.invoice_number}` : "Счёт готовится"}</div>
                        <div className="text-[13px] text-muted-foreground">КП № {o.quotes?.number}</div>
                      </td>
                      <td className="whitespace-nowrap px-3 py-4">{new Date(o.created_at).toLocaleDateString("ru-RU")}</td>
                      <td className="whitespace-nowrap px-3 py-4 text-right tabular-nums">{formatTenge(Number(o.total_kzt))}</td>
                      <td className="px-6 py-4"><span className={`badge ${s.cls}`}>{s.label}</span></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
