"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { getSupabase } from "@/lib/supabase/server";
import { notifyStaffAboutSpec } from "@/lib/notifications";
import { parseSpec } from "@/lib/spec-ai/parse";

const MAX_BYTES = 20 * 1024 * 1024;
const ALLOWED = /\.(xlsx?|csv|pdf|docx?|jpe?g|png|heic)$/i;

export type UploadState = { ok?: boolean; error?: string; fileName?: string } | undefined;

export async function uploadSpec(_prev: UploadState, form: FormData): Promise<UploadState> {
  const file = form.get("file");
  if (!(file instanceof File) || file.size === 0) return { error: "Выберите файл заявки" };
  if (file.size > MAX_BYTES) return { error: "Файл больше 20 МБ" };
  if (!ALLOWED.test(file.name)) return { error: "Подходят Excel, CSV, PDF, Word или фото" };

  const supabase = await getSupabase();
  if (!supabase) return { error: "База не подключена" };
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { error: "Войдите, чтобы отправить спецификацию" };

  const { data: company } = await supabase.from("companies").select("id, name, legal_form").limit(1).maybeSingle();
  if (!company) return { error: "Сначала укажите данные компании в кабинете" };

  // Keep the original name for people, but store under a safe generated key.
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "bin";
  const path = `${company.id}/${Date.now()}-${crypto.randomUUID()}.${ext}`;

  const { error: upErr } = await supabase.storage.from("specs").upload(path, file, { contentType: file.type || undefined });
  if (upErr) return { error: "Не удалось загрузить файл. Попробуйте ещё раз." };

  const { data: spec, error: rowErr } = await supabase
    .from("specs")
    .insert({ company_id: company.id, file_path: path, file_name: file.name.slice(0, 200) })
    .select("id")
    .single();
  if (rowErr || !spec) return { error: "Файл загружен, но заявка не сохранилась. Позвоните нам." };

  // После ответа: письмо менеджеру и разбор ИИ (черновик позиций для менеджера, обычно 1–3 минуты).
  after(async () => {
    await notifyStaffAboutSpec(company, file.name);
    await parseSpec(spec.id as string);
  });
  revalidatePath("/spec");
  return { ok: true, fileName: file.name };
}
