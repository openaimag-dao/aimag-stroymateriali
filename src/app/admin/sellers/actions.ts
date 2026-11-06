"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireStaff } from "@/lib/staff";

// Телефон в документах фиксирован (+7 705 615-17-17) и здесь не редактируется.
const schema = z.object({
  code: z.enum(["aimag", "bereke"]),
  director: z.string().trim().min(3).max(80),
  address: z.string().trim().max(200).optional(),
  bank_name: z.string().trim().max(120).optional(),
  bik: z.string().trim().toUpperCase().refine((v) => v === "" || /^[A-Z0-9]{8}$/.test(v), "БИК — 8 латинских букв и цифр").optional(),
  iban: z.string().transform((v) => v.replace(/\s/g, "").toUpperCase()).refine((v) => v === "" || /^KZ\d{2}[A-Z0-9]{16}$/.test(v), "ИИК — KZ и 18 знаков").optional(),
  kbe: z.string().trim().refine((v) => v === "" || /^\d{2}$/.test(v), "Кбе — 2 цифры").optional(),
  knp: z.string().trim().regex(/^\d{3}$/, "КНП — 3 цифры"),
});

const back = (msg: string) => redirect(`/admin/sellers?msg=${encodeURIComponent(msg)}`);

export async function saveSeller(form: FormData) {
  const { supabase } = await requireStaff();
  const parsed = schema.safeParse(Object.fromEntries(form));
  if (!parsed.success) back(parsed.error.issues[0]?.message ?? "Проверьте поля");
  const v = parsed.data!;
  const { error } = await supabase
    .from("sellers")
    .update({
      director: v.director,
      address: v.address || null,
      bank_name: v.bank_name || null,
      bik: v.bik || null,
      iban: v.iban || null,
      kbe: v.kbe || null,
      knp: v.knp,
    })
    .eq("code", v.code);
  revalidatePath("/admin/sellers");
  back(error ? `Не сохранено: ${error.message}` : "Реквизиты сохранены");
}

/** Печать или подпись: PNG/JPG до 2 МБ в закрытое хранилище branding/<code>/…, путь — в sellers. */
export async function uploadSellerImage(form: FormData) {
  const { supabase } = await requireStaff();
  const code = String(form.get("code"));
  const kind = String(form.get("kind"));
  const file = form.get("file");
  if (!["aimag", "bereke"].includes(code) || !["stamp", "signature"].includes(kind)) back("Неверный запрос");
  if (!(file instanceof File) || file.size === 0) back("Выберите файл");
  const f = file as File;
  if (f.size > 2 * 1024 * 1024) back("Файл больше 2 МБ");
  const ext = f.type === "image/png" ? "png" : f.type === "image/jpeg" ? "jpg" : null;
  if (!ext) back("Нужен PNG или JPG (лучше PNG с прозрачным фоном)");

  const path = `${code}/${kind}-${Date.now()}.${ext}`;
  const up = await supabase.storage.from("branding").upload(path, f, { contentType: f.type, upsert: false });
  if (up.error) back(`Не загружено: ${up.error.message}`);
  const { error } = await supabase.from("sellers").update({ [kind === "stamp" ? "stamp_url" : "signature_url"]: path }).eq("code", code);
  revalidatePath("/admin/sellers");
  back(error ? `Не сохранено: ${error.message}` : kind === "stamp" ? "Печать загружена" : "Подпись загружена");
}
