"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getSupabase } from "@/lib/supabase/server";
import { isValidBin, normalizeBin } from "@/lib/bin";
import { lookupBin, type BinInfo } from "@/lib/bin-lookup";

const schema = z.object({
  bin: z.string().transform(normalizeBin).refine(isValidBin, "БИН/ИИН не прошёл проверку контрольной цифры"),
  name: z.string().trim().min(2, "Укажите название компании"),
  legalForm: z.enum(["ТОО", "ИП", "АО", "Другое"]),
  director: z.string().trim().optional(),
  address: z.string().trim().optional(),
  fullName: z.string().trim().min(2, "Укажите контактное лицо"),
  phone: z.string().trim().min(10, "Укажите телефон"),
  invoiceEmail: z.string().trim().email("Неверный email").optional().or(z.literal("")),
  bik: z.string().trim().optional(),
  iban: z
    .string()
    .trim()
    .toUpperCase()
    .refine((v) => v === "" || /^KZ\d{2}[A-Z0-9]{16}$/.test(v), "ИИК: KZ и 18 знаков")
    .optional(),
});

export type RegisterState = { error?: string } | undefined;

export async function registerCompany(_prev: RegisterState, form: FormData): Promise<RegisterState> {
  const parsed = schema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Проверьте поля" };

  const supabase = await getSupabase();
  if (!supabase) return { error: "База не подключена" };

  const v = parsed.data;
  const { error } = await supabase.rpc("register_company", {
    p_bin: v.bin,
    p_name: v.name,
    p_legal_form: v.legalForm,
    p_director: v.director || null,
    p_address: v.address || null,
    p_full_name: v.fullName,
    p_phone: v.phone,
    p_invoice_email: v.invoiceEmail || null,
    p_bik: v.bik || null,
    p_iban: v.iban || null,
  });
  if (error) {
    if (error.message.includes("company_exists")) {
      return { error: "Компания с этим БИН уже зарегистрирована. Попросите владельца аккаунта добавить вас или позвоните нам." };
    }
    return { error: "Не удалось зарегистрировать компанию. Попробуйте ещё раз." };
  }
  revalidatePath("/account");
  return undefined;
}

export type BinLookupState = { info?: BinInfo; error?: string };

/** Реквизиты из реестра stat.gov.kz для автозаполнения формы. Только для вошедших — чтобы сайт не стал открытым прокси к реестру. */
export async function lookupCompanyByBin(raw: string): Promise<BinLookupState> {
  const bin = normalizeBin(raw);
  if (!isValidBin(bin)) return { error: "БИН/ИИН не прошёл проверку контрольной цифры" };

  const supabase = await getSupabase();
  if (!supabase) return { error: "База не подключена" };
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { error: "Войдите, чтобы заполнить реквизиты" };

  const res = await lookupBin(bin);
  if (res.ok) return { info: res.info };
  return {
    error:
      res.reason === "not_found"
        ? "В реестре stat.gov.kz такой БИН не найден — заполните реквизиты вручную."
        : "Реестр stat.gov.kz сейчас не отвечает — заполните реквизиты вручную.",
  };
}

export async function signOut() {
  const supabase = await getSupabase();
  await supabase?.auth.signOut();
  revalidatePath("/", "layout");
}
