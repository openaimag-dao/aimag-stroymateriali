import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Check } from "lucide-react";
import { getUser } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { EmailLoginForm } from "@/components/auth/email-login-form";

export const metadata: Metadata = { title: "Вход для юрлиц", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

const perks = [
  "Оптовые цены с НДС по всему каталогу",
  "КП и счёт на ваши реквизиты в один клик",
  "История заказов, повтор заказа и все документы",
  "Загрузка спецификаций с ответом за 15 минут",
];

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  if (await getUser()) redirect(next?.startsWith("/") ? next : "/account");

  return (
    <div className="container flex flex-wrap items-start justify-center gap-8 py-12">
      <section aria-labelledby="login-h" className="card flex min-w-0 max-w-[620px] flex-[1_1_520px] flex-col gap-5 p-8">
        <div className="flex flex-col gap-2">
          <h1 id="login-h" className="font-display text-[28px] font-semibold tracking-tight">Вход для ТОО и ИП</h1>
          <p className="text-steel-500">
            Введите рабочий email — пришлём ссылку для входа. При первом входе укажете БИН компании.
          </p>
        </div>
        {isSupabaseConfigured() ? (
          <EmailLoginForm next={next} />
        ) : (
          <p className="rounded-lg bg-amber-50 p-4 text-sm text-amber-900">Вход заработает после подключения Supabase.</p>
        )}
      </section>
      <aside className="flex min-w-0 max-w-[420px] flex-[1_1_300px] flex-col gap-3.5 pt-2">
        <h2 className="text-[19px] font-semibold">Что даёт регистрация</h2>
        <ul className="flex flex-col gap-3.5 text-[15px] text-steel-700">
          {perks.map((p) => (
            <li key={p} className="flex gap-2.5">
              <Check className="mt-0.5 h-5 w-5 shrink-0 text-emerald-700" strokeWidth={2.2} aria-hidden="true" />
              {p}
            </li>
          ))}
        </ul>
      </aside>
    </div>
  );
}
