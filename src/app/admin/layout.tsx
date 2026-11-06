import Link from "next/link";
import type { Metadata } from "next";
import { requireStaff } from "@/lib/staff";

export const metadata: Metadata = { title: "Админка", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

const nav = [
  { href: "/admin", label: "Обзор" },
  { href: "/admin/import", label: "Загрузка прайсов" },
  { href: "/admin/quotes", label: "КП и счета" },
  { href: "/admin/specs", label: "Спецификации" },
  { href: "/admin/settings", label: "Курс и наценки" },
  { href: "/admin/sellers", label: "Реквизиты продавцов" },
];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const { role } = await requireStaff();
  return (
    <div className="container flex flex-wrap items-start gap-6 py-8">
      <nav aria-label="Админка" className="card flex max-w-full flex-[1_1_220px] flex-col gap-1 p-3 text-[15px]">
        <span className="px-3 pb-2 pt-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Админка · {role === "admin" ? "администратор" : "менеджер"}
        </span>
        {nav.map((n) => (
          <Link key={n.href} href={n.href} className="flex min-h-11 items-center rounded-lg px-3 hover:bg-steel-50">
            {n.label}
          </Link>
        ))}
      </nav>
      <div className="flex min-w-0 flex-[999_1_640px] flex-col gap-5">{children}</div>
    </div>
  );
}
