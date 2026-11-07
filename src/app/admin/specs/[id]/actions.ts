"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireStaff } from "@/lib/staff";
import { parseSpec } from "@/lib/spec-ai/parse";

const back = (id: string, msg: string) => redirect(`/admin/specs/${id}?msg=${encodeURIComponent(msg)}`);
const STATUSES = new Set(["pending", "found", "to_order", "not_supplied"]);

const errText: Record<string, string> = {
  no_matched_items: "Нет позиций со статусом «Найдено», товаром и количеством.",
  product_unavailable: "Один из выбранных товаров снят с продажи — выберите другой.",
  too_many_lines: "Больше 200 позиций в одном КП — разбейте заявку.",
  bad_qty: "Проверьте количество.",
};
const text = (m: string) => Object.entries(errText).find(([k]) => m.includes(k))?.[1] ?? "Не удалось создать КП.";

export async function rerunSpecParse(specId: string) {
  await requireStaff();
  const r = await parseSpec(specId);
  revalidatePath(`/admin/specs/${specId}`);
  back(
    specId,
    r.status === "done"
      ? `Разобрано: ${r.lines} позиций, найдено в каталоге ${r.found}${r.error ? `. ${r.error}` : ""}`
      : `Не разобрано: ${r.error ?? "ошибка"}`,
  );
}

/** Правки менеджера: товар (из кандидатов или по артикулу), количество и статус каждой позиции. */
async function applyItems(specId: string, form: FormData): Promise<{ error?: string; missingSku: string[] }> {
  const { supabase, user } = await requireStaff();
  const { data: rows, error } = await supabase
    .from("spec_items")
    .select("spec_id, line_no, source_text, name, qty, unit, product_id, match_status, confidence, note, candidates")
    .eq("spec_id", specId);
  if (error || !rows) return { error: "Не удалось прочитать позиции", missingSku: [] };

  const skus = [...new Set(rows.map((r) => String(form.get(`sku_${r.line_no}`) ?? "").trim()).filter(Boolean))];
  const bySku = new Map<string, string>();
  if (skus.length) {
    const { data } = await supabase.from("products").select("id, sku").in("sku", skus).eq("is_active", true);
    for (const p of data ?? []) bySku.set(String(p.sku), p.id as string);
  }

  const missingSku: string[] = [];
  const updated = rows.map((r) => {
    const n = r.line_no as number;
    const sku = String(form.get(`sku_${n}`) ?? "").trim();
    const picked = String(form.get(`product_${n}`) ?? "");
    const productId = sku ? (bySku.get(sku) ?? null) : picked || null;
    if (sku && !productId) missingSku.push(sku);

    const qtyRaw = String(form.get(`qty_${n}`) ?? "").replace(/\s/g, "").replace(",", ".");
    const qty = qtyRaw === "" ? null : Number(qtyRaw);
    let status = String(form.get(`status_${n}`) ?? r.match_status);
    if (!STATUSES.has(status)) status = r.match_status as string;
    if (status === "found" && !productId) status = "pending";

    return {
      ...r,
      product_id: sku && !productId ? r.product_id : productId,
      qty: qty !== null && Number.isFinite(qty) && qty > 0 && qty <= 1_000_000 ? qty : null,
      match_status: status,
      confirmed_by: user.id,
    };
  });

  const { error: upErr } = updated.length
    ? await supabase.from("spec_items").upsert(updated, { onConflict: "spec_id,line_no" })
    : { error: null };
  revalidatePath(`/admin/specs/${specId}`);
  return upErr ? { error: "Не удалось сохранить позиции", missingSku } : { missingSku };
}

const skuText = (missing: string[]) => `артикулы не найдены: ${missing.join(", ")}`;

export async function saveSpecItems(specId: string, form: FormData) {
  const r = await applyItems(specId, form);
  if (r.error) back(specId, r.error);
  back(specId, r.missingSku.length ? `Сохранено, но ${skuText(r.missingSku)}` : "Позиции сохранены");
}

/** Сохраняет правки и создаёт КП из позиций «Найдено» — цены считает база. */
export async function saveAndCreateQuote(specId: string, form: FormData) {
  const r = await applyItems(specId, form);
  if (r.error) back(specId, r.error);
  if (r.missingSku.length) back(specId, `КП не создано: ${skuText(r.missingSku)}`);

  const { supabase } = await requireStaff();
  const { data: quoteId, error } = await supabase.rpc("staff_quote_from_spec", { p_spec_id: specId });
  revalidatePath("/admin/specs");
  if (error || !quoteId) back(specId, text(error?.message ?? ""));
  redirect(`/admin/quotes/${quoteId}?msg=${encodeURIComponent("КП создано из спецификации — укажите доставку и отправьте покупателю")}`);
}
