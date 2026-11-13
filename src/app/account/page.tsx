import Link from "next/link";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSupabase } from "@/lib/supabase/server";
import { formatTenge } from "@/lib/money";
import { formatDocDate } from "@/lib/documents";
import { siteConfig } from "@/config/site";
import { RegisterCompanyForm } from "@/components/account/register-company-form";
import { AcceptInviteCard, InviteForm, RemoveMemberButton, RevokeInviteButton, roleLabels } from "@/components/account/team";
import { companyTitle } from "@/lib/company-title";
import { signOut } from "./actions";

export const metadata: Metadata = { title: "Кабинет компании", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

const statuses: Record<string, { label: string; cls: string }> = {
  awaiting_payment: { label: "Ожидает оплаты", cls: "bg-amber-50 text-amber-900" },
  paid: { label: "Оплачен", cls: "bg-blue-50 text-blue-800" },
  shipped: { label: "Отгружен", cls: "bg-steel-100 text-steel-700" },
  delivered: { label: "Доставлен", cls: "bg-emerald-50 text-emerald-800" },
  cancelled: { label: "Отменён", cls: "bg-steel-50 text-steel-500" },
};

type Invite = { id: string; company_name: string; legal_form: string | null; bin: string; role: string; created_at: string };
type Member = { user_id: string; full_name: string | null; phone: string | null; role: string; email: string; is_me: boolean };

type QuoteRow = {
  id: string;
  number: string;
  created_at: string;
  valid_until: string;
  total_kzt: number;
  orders: { invoice_number: string | null; status: string } | { invoice_number: string | null; status: string }[] | null;
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
    // приглашения на email вошедшего (функция отдаёт название компании, которую он пока не видит)
    const { data: invites } = await supabase.rpc("my_invites");
    const list = (invites ?? []) as Invite[];
    return (
      <div className="container flex max-w-[760px] flex-col gap-6 py-10">
        {list.map((i) => (
          <AcceptInviteCard
            key={i.id}
            inviteId={i.id}
            companyTitle={companyTitle({ name: i.company_name, legal_form: i.legal_form })}
            bin={i.bin}
            role={i.role}
          />
        ))}
        {list.length > 0 && <p className="text-sm text-muted-foreground">Или зарегистрируйте другую компанию:</p>}
        <RegisterCompanyForm />
        {list.length === 0 && (
          <p className="text-sm text-muted-foreground">
            Компания уже зарегистрирована коллегой? Попросите владельца кабинета пригласить вас по email {auth.user.email} — приглашение
            появится здесь.
          </p>
        )}
      </div>
    );
  }

  const [{ data: memberRows }, { data: inviteRows }] = await Promise.all([
    supabase.rpc("my_company_members"),
    supabase.from("company_invites").select("id, email, role, created_at").is("accepted_at", null).order("created_at"),
  ]);
  const members = (memberRows ?? []) as Member[];
  const openInvites = (inviteRows ?? []) as { id: string; email: string; role: string; created_at: string }[];
  const isOwner = members.some((m) => m.is_me && m.role === "owner");

  const { data: quotes } = await supabase
    .from("quotes")
    .select("id, number, created_at, valid_until, total_kzt, orders(invoice_number, status)")
    .eq("company_id", company.id)
    .order("created_at", { ascending: false })
    .limit(50);
  const today = new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Almaty" });

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
        <h2 id="orders-h" className="px-6 pb-2 pt-5 text-[19px] font-semibold">КП и счета</h2>
        {!quotes || quotes.length === 0 ? (
          <p className="px-6 pb-6 text-steel-500">
            Документов пока нет. Соберите корзину в <Link href="/catalog" className="font-semibold underline">каталоге</Link> или{" "}
            <Link href="/spec" className="font-semibold underline">загрузите спецификацию</Link>.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] border-collapse text-[15px]">
              <thead>
                <tr className="text-left text-[13px] text-muted-foreground">
                  <th scope="col" className="px-6 py-3 font-medium">Документ</th>
                  <th scope="col" className="px-3 py-3 font-medium">Дата</th>
                  <th scope="col" className="px-3 py-3 text-right font-medium">Сумма с НДС</th>
                  <th scope="col" className="px-6 py-3 font-medium">Статус</th>
                </tr>
              </thead>
              <tbody>
                {(quotes as unknown as QuoteRow[]).map((q) => {
                  const order = Array.isArray(q.orders) ? q.orders[0] : q.orders;
                  const s = order
                    ? (statuses[order.status] ?? statuses.awaiting_payment)
                    : q.valid_until < today
                      ? { label: "КП истекло", cls: "bg-steel-50 text-steel-500" }
                      : { label: "КП, счёт не выставлен", cls: "bg-steel-100 text-steel-700" };
                  return (
                    <tr key={q.id} className="border-t border-steel-100">
                      <td className="px-6 py-4">
                        <Link href={`/account/quotes/${q.id}`} className="font-semibold underline-offset-4 hover:underline">
                          КП № {q.number}
                        </Link>
                        {order?.invoice_number && <div className="text-[13px] text-muted-foreground">Счёт № {order.invoice_number}</div>}
                      </td>
                      <td className="whitespace-nowrap px-3 py-4">{formatDocDate(q.created_at)}</td>
                      <td className="whitespace-nowrap px-3 py-4 text-right tabular-nums">{formatTenge(Number(q.total_kzt))}</td>
                      <td className="px-6 py-4"><span className={`badge ${s.cls}`}>{s.label}</span></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section aria-labelledby="team-h" className="card flex flex-col gap-4 p-6">
        <div>
          <h2 id="team-h" className="text-[19px] font-semibold">Сотрудники</h2>
          <p className="text-sm text-muted-foreground">
            Все сотрудники видят цены, корзину, КП и счета компании.{isOwner ? " Пригласите закупщиков и бухгалтера по email." : ""}
          </p>
        </div>
        <ul className="flex flex-col divide-y divide-steel-100">
          {members.map((m) => (
            <li key={m.user_id} className="flex flex-wrap items-center justify-between gap-2 py-3">
              <div>
                <div className="font-semibold">
                  {m.full_name || m.email} {m.is_me && <span className="font-normal text-muted-foreground">(вы)</span>}
                </div>
                <div className="text-[13px] text-muted-foreground">
                  {roleLabels[m.role] ?? m.role} · {m.email}
                  {m.phone ? ` · ${m.phone}` : ""}
                </div>
              </div>
              {isOwner && !m.is_me && m.role !== "owner" && <RemoveMemberButton userId={m.user_id} name={m.full_name || m.email} />}
            </li>
          ))}
          {openInvites.map((i) => (
            <li key={i.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
              <div>
                <div className="font-semibold">{i.email}</div>
                <div className="text-[13px] text-muted-foreground">
                  {roleLabels[i.role] ?? i.role} · приглашён {formatDocDate(i.created_at)}, ещё не вошёл
                </div>
              </div>
              {isOwner && <RevokeInviteButton inviteId={i.id} />}
            </li>
          ))}
        </ul>
        {isOwner && <InviteForm />}
      </section>
    </div>
  );
}
