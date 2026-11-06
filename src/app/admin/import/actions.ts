"use server";

import { revalidatePath } from "next/cache";
import { unstable_rethrow } from "next/navigation";
import { requireStaff } from "@/lib/staff";
import { readSheet } from "@/lib/sheet-reader";
import { loadImportContext } from "@/lib/import-context";
import { shortHash, validateRows, type RowResult } from "@/lib/price-import";

export type PreviewResult = {
  error?: string;
  fileName?: string;
  total?: number;
  okCount?: number;
  errorCount?: number;
  rows?: { rowNo: number; name: string; price: number | null; errors: string[]; warnings: string[] }[];
};

export type CommitResult = { error?: string; written?: number; groupsCreated?: number; skipped?: number };

async function parse(form: FormData) {
  const { supabase } = await requireStaff();
  const file = form.get("file");
  if (!(file instanceof File) || file.size === 0) throw new Error("Выберите файл прайса.");
  const sheet = await readSheet(file);
  const ctx = await loadImportContext(supabase);
  const results = validateRows(sheet.headers, sheet.rows, ctx, sheet.firstRowNo);
  return { supabase, file, results };
}

export async function previewImport(form: FormData): Promise<PreviewResult> {
  try {
    const { file, results } = await parse(form);
    const okCount = results.filter((r) => r.row).length;
    // problems first, then the rest; cap what we send to the browser
    const sorted = [...results].sort((a, b) => Number(!!a.row) - Number(!!b.row) || a.rowNo - b.rowNo);
    return {
      fileName: file.name,
      total: results.length,
      okCount,
      errorCount: results.length - okCount,
      rows: sorted.slice(0, 500).map((r: RowResult) => ({
        rowNo: r.rowNo,
        name: r.name,
        price: r.row?.priceKzt ?? null,
        errors: r.errors,
        warnings: r.warnings,
      })),
    };
  } catch (e) {
    unstable_rethrow(e); // let the staff guard's redirect / 404 through
    return { error: e instanceof Error ? e.message : "Не удалось прочитать файл." };
  }
}

const chunk = <T,>(arr: T[], n: number) => Array.from({ length: Math.ceil(arr.length / n) }, (_, i) => arr.slice(i * n, i * n + n));

/** Re-reads and re-validates the same file (nothing from the browser preview is trusted), then writes valid rows. */
export async function commitImport(form: FormData): Promise<CommitResult> {
  try {
    const { supabase, file, results } = await parse(form);
    const valid = results.flatMap((r) => (r.row ? [r.row] : []));
    if (valid.length === 0) return { error: "Нет строк без ошибок — исправьте файл." };
    const batch = `${file.name.slice(0, 80)} · ${new Date().toISOString().slice(0, 16).replace("T", " ")}`;

    // groups: find existing by category + name (case-insensitive), create the rest
    const wanted = new Map<string, { categoryId: number; categorySlug: string; name: string }>();
    for (const r of valid) {
      if (r.groupName) wanted.set(`${r.categoryId}|${r.groupName.toLowerCase()}`, { categoryId: r.categoryId, categorySlug: r.categorySlug, name: r.groupName });
    }
    const groupId = new Map<string, string>();
    let groupsCreated = 0;
    if (wanted.size) {
      const catIds = [...new Set([...wanted.values()].map((g) => g.categoryId))];
      const { data: existing, error } = await supabase.from("product_groups").select("id, category_id, name").in("category_id", catIds);
      if (error) throw new Error(error.message);
      for (const g of existing ?? []) groupId.set(`${g.category_id}|${String(g.name).toLowerCase()}`, g.id as string);
      const missing = [...wanted.entries()].filter(([k]) => !groupId.has(k));
      if (missing.length) {
        const { data: created, error: insErr } = await supabase
          .from("product_groups")
          .insert(missing.map(([k, g]) => ({ category_id: g.categoryId, name: g.name, slug: `${g.categorySlug}-${shortHash(k)}` })))
          .select("id, category_id, name");
        if (insErr) throw new Error(insErr.message);
        for (const g of created ?? []) groupId.set(`${g.category_id}|${String(g.name).toLowerCase()}`, g.id as string);
        groupsCreated = created?.length ?? 0;
      }
    }

    const now = new Date().toISOString();
    let written = 0;
    for (const part of chunk(valid, 200)) {
      const { data: saved, error } = await supabase
        .from("products")
        .upsert(
          part.map((r) => ({
            sku: r.sku,
            category_id: r.categoryId,
            group_id: r.groupName ? (groupId.get(`${r.categoryId}|${r.groupName.toLowerCase()}`) ?? null) : null,
            name: r.name,
            spec: r.spec,
            unit: r.unit,
            purchase_price: r.purchase,
            purchase_currency: r.currency,
            logistics_kzt: r.logisticsKzt,
            markup_pct: r.markupPct,
            price_kzt: r.priceKzt,
            price_locked: r.priceLocked,
            price_updated_at: now,
            in_stock: r.inStock,
            lead_time_days: r.leadTimeDays,
            is_active: true,
            import_batch: batch,
            updated_at: now,
          })),
          { onConflict: "sku" },
        )
        .select("id, sku");
      if (error) throw new Error(`Строки ${written + 1}–${written + part.length}: ${error.message}`);

      const idBySku = new Map((saved ?? []).map((p) => [p.sku as string, p.id as string]));
      const ids = [...idBySku.values()];
      const attrs = part.flatMap((r) => r.attrs.map((a) => ({ product_id: idBySku.get(r.sku)!, attribute_id: a.attributeId, value: a.value })));
      const tiers = part.flatMap((r) => (r.tier ? [{ product_id: idBySku.get(r.sku)!, min_qty: r.tier.minQty, price_kzt: r.tier.priceKzt }] : []));

      // characteristics and wholesale tiers are replaced by what the price list says now
      const delAttrs = await supabase.from("product_attributes").delete().in("product_id", ids);
      if (delAttrs.error) throw new Error(delAttrs.error.message);
      if (attrs.length) {
        const ins = await supabase.from("product_attributes").insert(attrs);
        if (ins.error) throw new Error(ins.error.message);
      }
      const delTiers = await supabase.from("price_tiers").delete().in("product_id", ids);
      if (delTiers.error) throw new Error(delTiers.error.message);
      if (tiers.length) {
        const ins = await supabase.from("price_tiers").insert(tiers);
        if (ins.error) throw new Error(ins.error.message);
      }
      written += part.length;
    }

    revalidatePath("/catalog", "layout");
    revalidatePath("/admin");
    return { written, groupsCreated, skipped: results.length - valid.length };
  } catch (e) {
    unstable_rethrow(e);
    return { error: e instanceof Error ? e.message : "Не удалось записать прайс." };
  }
}
