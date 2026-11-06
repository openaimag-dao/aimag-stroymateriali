"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireStaff } from "@/lib/staff";

const today = () => new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Almaty" });
const num = (v: FormDataEntryValue | null) => Number(String(v ?? "").replace(/\s/g, "").replace(",", "."));

export async function saveRates(form: FormData) {
  const { supabase } = await requireStaff();
  const rows = (["RUB", "CNY"] as const)
    .map((c) => ({ currency: c, rate_date: today(), kzt_per_unit: num(form.get(c)) }))
    .filter((r) => Number.isFinite(r.kzt_per_unit) && r.kzt_per_unit > 0 && r.kzt_per_unit < 10000);
  if (rows.length) {
    const { error } = await supabase.from("exchange_rates").upsert(rows, { onConflict: "currency,rate_date" });
    if (error) redirect(`/admin/settings?msg=${encodeURIComponent("Курс не сохранён: " + error.message)}`);
  }
  revalidatePath("/admin/settings");
  redirect(`/admin/settings?msg=${encodeURIComponent(`Курс сохранён на ${today()}`)}`);
}

export async function saveMarkups(form: FormData) {
  const { supabase } = await requireStaff();
  for (const [key, value] of form.entries()) {
    if (!key.startsWith("m.")) continue;
    const id = Number(key.slice(2));
    const pct = num(value);
    if (!Number.isInteger(id) || !Number.isFinite(pct) || pct < 0 || pct > 300) continue;
    const { error } = await supabase.from("categories").update({ markup_pct: pct }).eq("id", id);
    if (error) redirect(`/admin/settings?msg=${encodeURIComponent("Наценки не сохранены: " + error.message)}`);
  }
  revalidatePath("/admin/settings");
  redirect(`/admin/settings?msg=${encodeURIComponent("Наценки сохранены. Чтобы применить к ценам — нажмите «Пересчитать цены».")}`);
}

export async function recalcPrices() {
  const { supabase } = await requireStaff();
  const { data, error } = await supabase.rpc("staff_recalc_prices");
  revalidatePath("/catalog", "layout");
  const msg = error ? `Пересчёт не выполнен: ${error.message}` : `Пересчитано цен: ${data ?? 0}`;
  redirect(`/admin/settings?msg=${encodeURIComponent(msg)}`);
}
