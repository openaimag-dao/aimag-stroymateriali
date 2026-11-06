import { revalidatePath } from "next/cache";
import { requireStaff } from "@/lib/staff";
import { formatDocDate } from "@/lib/documents";

const statuses: Record<string, string> = {
  parsing: "Новая",
  review: "В работе",
  quoted: "КП отправлено",
  rejected: "Отклонена",
};

type Row = {
  id: string;
  file_name: string;
  file_path: string;
  status: string;
  created_at: string;
  companies: { name: string; legal_form: string | null; bin: string } | null;
};

async function setSpecStatus(specId: string, form: FormData) {
  "use server";
  const { supabase } = await requireStaff();
  const status = String(form.get("status"));
  if (!(status in statuses)) return;
  await supabase.from("specs").update({ status }).eq("id", specId);
  revalidatePath("/admin/specs");
}

export default async function AdminSpecs() {
  const { supabase } = await requireStaff();
  const { data } = await supabase
    .from("specs")
    .select("id, file_name, file_path, status, created_at, companies(name, legal_form, bin)")
    .order("created_at", { ascending: false })
    .limit(200);
  const rows = (data ?? []) as unknown as Row[];

  // download links valid for 10 minutes (the bucket is private)
  const signed = rows.length
    ? ((await supabase.storage.from("specs").createSignedUrls(rows.map((r) => r.file_path), 600, { download: true })).data ?? [])
    : [];
  const link = new Map(signed.flatMap((s) => (s.path && s.signedUrl ? [[s.path, s.signedUrl] as const] : [])));

  return (
    <>
      <h1 className="font-display text-[28px] font-semibold">Спецификации</h1>
      <p className="text-sm text-muted-foreground">Обещание покупателю — КП в течение 15 минут в рабочее время. Новые заявки сверху.</p>
      {rows.length === 0 ? (
        <p className="card p-6 text-steel-500">Заявок пока нет.</p>
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full min-w-[760px] border-collapse text-[15px]">
            <thead>
              <tr className="text-left text-[13px] text-muted-foreground">
                <th scope="col" className="px-5 py-3 font-medium">Файл</th>
                <th scope="col" className="px-3 py-3 font-medium">Покупатель</th>
                <th scope="col" className="px-3 py-3 font-medium">Получена</th>
                <th scope="col" className="px-5 py-3 font-medium">Статус</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-t border-steel-100 align-top">
                  <td className="break-all px-5 py-3.5">
                    {link.get(r.file_path) ? (
                      <a href={link.get(r.file_path)} className="font-semibold underline">{r.file_name}</a>
                    ) : (
                      <span className="font-semibold">{r.file_name}</span>
                    )}
                  </td>
                  <td className="px-3 py-3.5">
                    {r.companies?.legal_form} {r.companies?.name}
                    <div className="text-[13px] text-muted-foreground">БИН {r.companies?.bin}</div>
                  </td>
                  <td className="whitespace-nowrap px-3 py-3.5">
                    {formatDocDate(r.created_at)}{" "}
                    {new Date(r.created_at).toLocaleTimeString("ru-RU", { timeZone: "Asia/Almaty", hour: "2-digit", minute: "2-digit" })}
                  </td>
                  <td className="px-5 py-3.5">
                    <form action={setSpecStatus.bind(null, r.id)} className="flex items-center gap-2">
                      <label className="sr-only" htmlFor={`st-${r.id}`}>Статус</label>
                      <select id={`st-${r.id}`} name="status" defaultValue={r.status} className="field h-9 w-40">
                        {Object.entries(statuses).map(([k, v]) => (
                          <option key={k} value={k}>{v}</option>
                        ))}
                      </select>
                      <button type="submit" className="btn-outline h-9 px-3 text-sm">OK</button>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
