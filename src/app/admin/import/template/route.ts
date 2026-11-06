import ExcelJS from "exceljs";
import { getSupabase } from "@/lib/supabase/server";
import { loadImportContext } from "@/lib/import-context";
import { COLUMNS } from "@/lib/price-import";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Excel template: «Прайс» to fill in, «Справочник» with subsections and allowed characteristic values, «Пример». */
export async function GET() {
  const supabase = await getSupabase();
  if (!supabase) return new Response("Not found", { status: 404 });
  const { data: auth } = await supabase.auth.getUser();
  const { data: staff } = auth.user
    ? await supabase.from("staff").select("role").eq("user_id", auth.user.id).maybeSingle()
    : { data: null };
  if (!staff) return new Response("Not found", { status: 404 });

  const ctx = await loadImportContext(supabase);
  const attrNames = [...new Set(ctx.categories.flatMap((c) => c.attrs.map((a) => a.name)))];
  const headers = [...Object.values(COLUMNS), ...attrNames];

  const wb = new ExcelJS.Workbook();
  wb.creator = "AIMAG Stroymateriali";

  const price = wb.addWorksheet("Прайс", { views: [{ state: "frozen", ySplit: 1 }] });
  price.addRow(headers);
  price.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
  price.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF121D2B" } };
  price.columns.forEach((c, i) => (c.width = Math.max(12, Math.min(34, String(headers[i]).length + 4))));

  const ref = wb.addWorksheet("Справочник");
  ref.addRow(["Подраздел (код)", "Подраздел", "Наценка по умолчанию, %", "Колонка характеристики", "Допустимые значения"]);
  ref.getRow(1).font = { bold: true };
  for (const c of ctx.categories.sort((a, b) => a.slug.localeCompare(b.slug))) {
    if (c.attrs.length === 0) ref.addRow([c.slug, c.name, c.markupPct, "—", ""]);
    for (const a of c.attrs) ref.addRow([c.slug, c.name, c.markupPct, a.name, a.options.map((o) => o.label).join("; ")]);
  }
  ref.columns = [{ width: 18 }, { width: 30 }, { width: 14 }, { width: 22 }, { width: 120 }];

  const ex = wb.addWorksheet("Пример");
  ex.addRow(headers);
  ex.getRow(1).font = { bold: true };
  const row = (v: Record<string, string | number>) => ex.addRow(headers.map((h) => v[h] ?? ""));
  row({ [COLUMNS.category]: "profnastil", [COLUMNS.group]: "Профнастил С21", [COLUMNS.name]: "Профнастил С21 0,5 мм RAL 3005", [COLUMNS.unit]: "м²",
    [COLUMNS.purchase]: 400, [COLUMNS.currency]: "RUB", [COLUMNS.logistics]: 50, [COLUMNS.inStock]: "да", [COLUMNS.tierQty]: 300, [COLUMNS.tierPrice]: 3100,
    "Профиль": "С21", "Толщина металла": "0,5", "Покрытие": "Полиэстер", "Цвет": "RAL 3005" });
  row({ [COLUMNS.sku]: "PPR-CPL-25", [COLUMNS.category]: "ppr-fittings", [COLUMNS.group]: "Фитинги PP-R", [COLUMNS.name]: "Муфта PP-R 25 мм", [COLUMNS.unit]: "шт",
    [COLUMNS.purchase]: 52, [COLUMNS.currency]: "KZT", [COLUMNS.inStock]: "да", "Тип": "Муфта", "Диаметр": "25" });
  row({ [COLUMNS.category]: "electro", [COLUMNS.name]: "Кабель ВВГнг(А)-LS 3×2,5", [COLUMNS.spec]: "ГОСТ 31996-2012", [COLUMNS.unit]: "м",
    [COLUMNS.price]: 690, [COLUMNS.inStock]: "нет", [COLUMNS.leadTime]: 5 });
  ex.addRow([]);
  ex.addRow(["Пример заполнения. Цены вымышленные. Загружается только первый лист «Прайс»."]);

  const buf = await wb.xlsx.writeBuffer();
  return new Response(new Uint8Array(buf as ArrayBuffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="price-template.xlsx"; filename*=UTF-8''${encodeURIComponent("Шаблон прайса.xlsx")}`,
      "Cache-Control": "private, no-store",
    },
  });
}
