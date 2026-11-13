import Link from "next/link";
import type { Metadata } from "next";
import { getSupabase } from "@/lib/supabase/server";
import { siteConfig } from "@/config/site";
import { SpecUploadForm } from "@/components/spec/spec-upload-form";

export const metadata: Metadata = {
  title: "Загрузить спецификацию — КП за 15 минут",
  description: "Загрузите заявку или ведомость объёмов в Excel, PDF, Word или фото — сопоставим позиции с каталогом и пришлём КП с НДС.",
  alternates: { canonical: "/spec" },
};
export const dynamic = "force-dynamic";
// разбор спецификации ИИ идёт после ответа в той же функции и может занять несколько минут
export const maxDuration = 300;

const specStatus: Record<string, { label: string; cls: string }> = {
  parsing: { label: "Разбираем", cls: "bg-steel-100 text-steel-700" },
  review: { label: "На проверке у менеджера", cls: "bg-amber-50 text-amber-900" },
  quoted: { label: "КП отправлено", cls: "bg-emerald-50 text-emerald-800" },
  rejected: { label: "Отклонена", cls: "bg-steel-50 text-steel-500" },
};

export default async function SpecPage() {
  const supabase = await getSupabase();
  const user = supabase ? (await supabase.auth.getUser()).data.user : null;
  const { data: specs } =
    supabase && user
      ? await supabase.from("specs").select("id, file_name, status, ai_status, created_at, spec_items(match_status)").order("created_at", { ascending: false }).limit(20)
      : { data: null };

  return (
    <div className="container flex flex-col gap-6 py-8">
      <div className="flex max-w-[760px] flex-col gap-2.5">
        <h1 className="font-display text-[34px] font-semibold tracking-tight">
          Спецификация → КП за {siteConfig.specResponseMinutes} минут
        </h1>
        <p className="text-[17px] leading-relaxed text-steel-500">
          Загрузите заявку или ведомость объёмов. Мы сопоставим позиции с каталогом, найдём недостающее под заказ и пришлём КП в
          рабочее время.
        </p>
      </div>

      {user ? (
        <SpecUploadForm />
      ) : (
        <div className="card flex flex-wrap items-center justify-between gap-4 p-6">
          <p className="text-steel-500">Чтобы КП пришло на реквизиты вашей компании, войдите по email и БИН.</p>
          <Link href="/login?next=/spec" className="btn-signal">Войти по БИН</Link>
        </div>
      )}

      {specs && specs.length > 0 && (
        <section aria-labelledby="specs-h" className="card overflow-x-auto">
          <h2 id="specs-h" className="px-6 pb-2 pt-5 text-[19px] font-semibold">Ваши заявки</h2>
          <table className="w-full min-w-[560px] border-collapse text-[15px]">
            <thead>
              <tr className="text-left text-[13px] text-muted-foreground">
                <th scope="col" className="px-6 py-3 font-medium">Файл</th>
                <th scope="col" className="px-3 py-3 font-medium">Дата</th>
                <th scope="col" className="px-6 py-3 font-medium">Статус</th>
              </tr>
            </thead>
            <tbody>
              {specs.map((s) => {
                const st = specStatus[s.status] ?? specStatus.parsing;
                const items = (s.spec_items ?? []) as { match_status: string }[];
                const found = items.filter((i) => i.match_status === "found").length;
                return (
                  <tr key={s.id} className="border-t border-steel-100">
                    <td className="break-all px-6 py-4 font-semibold">{s.file_name}</td>
                    <td className="whitespace-nowrap px-3 py-4">{new Date(s.created_at).toLocaleString("ru-RU")}</td>
                    <td className="px-6 py-4">
                      <span className={`badge ${st.cls}`}>{st.label}</span>
                      {s.status === "review" && s.ai_status === "done" && items.length > 0 && (
                        <div className="mt-1 text-[13px] text-muted-foreground">
                          Нашли в каталоге {found} из {items.length} позиций, менеджер проверяет
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>
      )}

      <p className="text-sm text-muted-foreground">
        Срочно? Позвоните: <a href={siteConfig.phoneHref} className="font-semibold text-foreground">{siteConfig.phone}</a>
      </p>
    </div>
  );
}
