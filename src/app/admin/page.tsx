import Link from "next/link";
import { requireStaff } from "@/lib/staff";

export default async function AdminHome() {
  const { supabase } = await requireStaff();
  const today = new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Almaty" });

  const [products, quotesToday, unpaid, specs, sellers] = await Promise.all([
    supabase.from("products").select("id", { count: "exact", head: true }).eq("is_active", true),
    supabase.from("quotes").select("id", { count: "exact", head: true }).gte("created_at", `${today}T00:00:00+05:00`),
    supabase.from("orders").select("id", { count: "exact", head: true }).eq("status", "awaiting_payment"),
    supabase.from("specs").select("id", { count: "exact", head: true }).in("status", ["parsing", "review"]),
    supabase.from("sellers").select("code, name, iban"),
  ]);

  const missingBank = (sellers.data ?? []).filter((s) => !s.iban);
  const tiles = [
    { label: "Товаров в каталоге", value: products.count ?? 0, href: "/admin/import" },
    { label: "КП за сегодня", value: quotesToday.count ?? 0, href: "/admin/quotes" },
    { label: "Счетов ждут оплаты", value: unpaid.count ?? 0, href: "/admin/quotes" },
    { label: "Спецификаций в работе", value: specs.count ?? 0, href: "/admin/specs" },
  ];

  return (
    <>
      <h1 className="font-display text-[28px] font-semibold">Обзор</h1>
      {missingBank.length > 0 && (
        <p role="alert" className="rounded-lg bg-amber-50 p-4 text-[15px] text-amber-900">
          Не заполнены банковские реквизиты: {missingBank.map((s) => s.name).join(", ")}. Без них счёт автоматически не выставляется.{" "}
          <Link href="/admin/sellers" className="font-semibold underline">Заполнить</Link>
        </p>
      )}
      <div className="grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-4">
        {tiles.map((t) => (
          <Link key={t.label} href={t.href} className="card flex flex-col gap-1 p-5 hover:border-signal">
            <span className="text-3xl font-bold tabular-nums">{t.value}</span>
            <span className="text-sm text-muted-foreground">{t.label}</span>
          </Link>
        ))}
      </div>
    </>
  );
}
