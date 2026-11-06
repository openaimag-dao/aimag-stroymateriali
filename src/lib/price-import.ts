/**
 * Price-list import: turns spreadsheet rows into validated catalog rows.
 * Pure (no DB, no file IO) so it is fully unit-tested; the server action
 * loads the context from Supabase and writes the result.
 */
import { sellingPrice } from "@/lib/pricing";

export const COLUMNS = {
  sku: "Артикул",
  category: "Подраздел",
  group: "Группа",
  name: "Наименование",
  spec: "Тип/марка",
  unit: "Ед.",
  purchase: "Закупка без НДС",
  currency: "Валюта",
  logistics: "Логистика, ₸/ед",
  markup: "Наценка, %",
  price: "Цена продажи с НДС, ₸",
  inStock: "В наличии",
  leadTime: "Срок, дн",
  tierQty: "Опт от",
  tierPrice: "Опт цена с НДС, ₸",
} as const;

export type ImportOption = { value: string; label: string };
export type ImportAttr = { id: number; code: string; name: string; options: ImportOption[] };
export type ImportCategory = { id: number; slug: string; name: string; markupPct: number; attrs: ImportAttr[] };
export type ImportContext = {
  categories: ImportCategory[];
  rates: Record<string, number>; // RUB → 5.65, CNY → 67.87
};

export type ImportRow = {
  sku: string;
  categoryId: number;
  categorySlug: string;
  groupName: string | null;
  name: string;
  spec: string | null;
  unit: string;
  purchase: number | null;
  currency: string;
  logisticsKzt: number;
  markupPct: number | null; // null → category markup at recalculation
  priceKzt: number;
  priceLocked: boolean; // price given explicitly in the file
  inStock: boolean;
  leadTimeDays: number | null;
  tier: { minQty: number; priceKzt: number } | null;
  attrs: { attributeId: number; value: string }[];
};

export type RowResult = { rowNo: number; errors: string[]; warnings: string[]; row: ImportRow | null; name: string };

export type Cell = string | number | boolean | null | undefined;

// ── helpers ───────────────────────────────────────────────────────────

// "Цена продажи с НДС, ₸" → "цена продажи с ндс": units after the comma are ignored, so a CSV saved
// in cp1251 (where ₸ becomes "?") still matches.
const normHeader = (h: string) => h.split(",")[0].toLowerCase().replace(/\s+/g, " ").replace(/[.:]+$/, "").trim();

function text(v: Cell): string {
  if (v === null || v === undefined) return "";
  return String(v).replace(/\s+/g, " ").trim();
}

/** "1 234,50" / "1234.5" / 1234.5 → 1234.5; empty → null; garbage → NaN */
export function parseNumber(v: Cell): number | null {
  if (typeof v === "number") return Number.isFinite(v) ? v : NaN;
  const s = text(v).replace(/[\s  ]/g, "").replace(/₸|тг|руб\.?|₽|%/gi, "").replace(",", ".");
  if (s === "") return null;
  return /^-?\d+(\.\d+)?$/.test(s) ? Number(s) : NaN;
}

function parseBool(v: Cell): boolean | null {
  const s = text(v).toLowerCase();
  if (s === "") return null;
  if (["да", "есть", "в наличии", "1", "+", "true", "yes"].includes(s)) return true;
  if (["нет", "под заказ", "0", "-", "false", "no"].includes(s)) return false;
  return null;
}

function normOption(s: string): string {
  return s.toLowerCase().replace(/[\s"″'«»]/g, "").replace(/,/g, ".").replace(/мм$/, "");
}

/** Finds a dictionary option by value or label, tolerant to "0,5"/"0.50 мм", "RAL 3005"/"3005", "1 1/4". */
export function matchOption(input: string, options: ImportOption[], isColor = false): ImportOption | undefined {
  const n = normOption(input);
  if (!n) return undefined;
  const num = Number(n);
  for (const o of options) {
    const v = normOption(o.value);
    const l = normOption(o.label);
    if (n === v || n === l) return o;
    if (Number.isFinite(num) && /^[\d.]+$/.test(n) && Number(v) === num) return o;
  }
  if (isColor) {
    const ral = input.match(/\b(\d{4})\b/);
    if (ral) return options.find((o) => o.value.toUpperCase() === `RAL${ral[1]}`);
  }
  return undefined;
}

/** Stable short hash (FNV-1a) for auto SKUs and group slugs. */
export function shortHash(s: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(36);
}

// ── main ──────────────────────────────────────────────────────────────

export function validateRows(headers: string[], rows: Cell[][], ctx: ImportContext, firstRowNo = 2): RowResult[] {
  const index = new Map(headers.map((h, i) => [normHeader(h), i]));
  const col = (row: Cell[], key: keyof typeof COLUMNS): Cell => {
    const i = index.get(normHeader(COLUMNS[key]));
    return i === undefined ? undefined : row[i];
  };
  const known = new Set(Object.values(COLUMNS).map(normHeader));
  const extraHeaders = headers.map((h, i) => ({ h: text(h), i })).filter(({ h }) => h && !known.has(normHeader(h)));

  const bySlugOrName = new Map<string, ImportCategory>();
  for (const c of ctx.categories) {
    bySlugOrName.set(c.slug.toLowerCase(), c);
    bySlugOrName.set(c.name.toLowerCase(), c);
  }
  const seenSku = new Map<string, number>();
  const results: RowResult[] = [];

  rows.forEach((raw, i) => {
    const rowNo = firstRowNo + i;
    if (raw.every((c) => text(c) === "")) return; // blank line
    const errors: string[] = [];
    const warnings: string[] = [];
    const name = text(col(raw, "name"));

    const catText = text(col(raw, "category"));
    const cat = bySlugOrName.get(catText.toLowerCase());
    if (!catText) errors.push("не указан подраздел");
    else if (!cat) errors.push(`подраздел «${catText}» не найден`);
    if (!name) errors.push("нет наименования");
    const unit = text(col(raw, "unit"));
    if (!unit) errors.push("нет единицы измерения");

    const currency = (text(col(raw, "currency")) || "KZT").toUpperCase().replace("₸", "KZT").replace("ТГ", "KZT").replace("РУБ", "RUB").replace("₽", "RUB").replace("ЮАНЬ", "CNY");
    if (!["KZT", "RUB", "CNY"].includes(currency)) errors.push(`валюта «${currency}»: нужна KZT, RUB или CNY`);

    const purchase = parseNumber(col(raw, "purchase"));
    const logistics = parseNumber(col(raw, "logistics")) ?? 0;
    const markup = parseNumber(col(raw, "markup"));
    const explicit = parseNumber(col(raw, "price"));
    const leadTime = parseNumber(col(raw, "leadTime"));
    const tierQty = parseNumber(col(raw, "tierQty"));
    const tierPrice = parseNumber(col(raw, "tierPrice"));
    for (const [label, v] of [
      [COLUMNS.purchase, purchase], [COLUMNS.logistics, logistics], [COLUMNS.markup, markup], [COLUMNS.price, explicit],
      [COLUMNS.leadTime, leadTime], [COLUMNS.tierQty, tierQty], [COLUMNS.tierPrice, tierPrice],
    ] as const) {
      if (Number.isNaN(v)) errors.push(`«${label}» — не число`);
      else if (v !== null && v < 0) errors.push(`«${label}» — отрицательное`);
    }

    let priceKzt: number | null = null;
    let priceLocked = false;
    if (explicit !== null && !Number.isNaN(explicit) && explicit > 0) {
      priceKzt = Math.round(explicit * 100) / 100;
      priceLocked = true;
    } else if (purchase !== null && !Number.isNaN(purchase) && purchase > 0 && cat) {
      const rate = currency === "KZT" ? 1 : ctx.rates[currency];
      if (!rate) errors.push(`нет курса ${currency} — укажите его в «Курс и наценки»`);
      else if (!Number.isNaN(logistics) && (markup === null || !Number.isNaN(markup))) {
        priceKzt = sellingPrice({ purchase, rateKztPerUnit: rate, logisticsKzt: logistics, markupPct: markup ?? cat.markupPct });
      }
    } else if (!errors.some((e) => e.includes("не число"))) {
      errors.push(`нужна «${COLUMNS.purchase}» или «${COLUMNS.price}»`);
    }

    let tier: ImportRow["tier"] = null;
    if ((tierQty === null) !== (tierPrice === null)) errors.push("для оптовой цены нужны и «Опт от», и «Опт цена»");
    else if (tierQty && tierPrice && !Number.isNaN(tierQty) && !Number.isNaN(tierPrice)) {
      tier = { minQty: tierQty, priceKzt: tierPrice };
      if (priceKzt !== null && tierPrice >= priceKzt) warnings.push("оптовая цена не ниже обычной");
    }

    const stock = parseBool(col(raw, "inStock"));
    if (text(col(raw, "inStock")) && stock === null) warnings.push("«В наличии»: ожидается да/нет — считаю «под заказ»");

    // characteristic columns: matched by the attribute name within this subcategory
    const attrs: ImportRow["attrs"] = [];
    if (cat) {
      for (const { h, i: ci } of extraHeaders) {
        const v = text(raw[ci]);
        if (!v) continue;
        const attr = cat.attrs.find((a) => normHeader(a.name) === normHeader(h) || a.code === h.trim());
        if (!attr) {
          warnings.push(`колонка «${h}» не относится к подразделу «${cat.name}» — пропущена`);
          continue;
        }
        const opt = matchOption(v, attr.options, attr.code === "ral");
        if (!opt) errors.push(`${attr.name}: значения «${v}» нет в справочнике`);
        else attrs.push({ attributeId: attr.id, value: opt.value });
      }
    }

    const sku = text(col(raw, "sku")) || (cat && name ? `AUTO-${shortHash(`${cat.slug}|${name.toLowerCase()}`)}` : "");
    if (sku) {
      const prev = seenSku.get(sku);
      if (prev) errors.push(`артикул «${sku}» повторяется (строка ${prev})`);
      else seenSku.set(sku, rowNo);
    }

    const ok = errors.length === 0 && cat && priceKzt !== null;
    results.push({
      rowNo,
      name: name || "(без названия)",
      errors,
      warnings,
      row: ok
        ? {
            sku,
            categoryId: cat.id,
            categorySlug: cat.slug,
            groupName: text(col(raw, "group")) || null,
            name,
            spec: text(col(raw, "spec")) || null,
            unit,
            purchase: purchase !== null && !Number.isNaN(purchase) ? purchase : null,
            currency,
            logisticsKzt: logistics,
            markupPct: markup,
            priceKzt: priceKzt!,
            priceLocked,
            inStock: stock ?? false,
            leadTimeDays: leadTime !== null && !Number.isNaN(leadTime) ? Math.round(leadTime) : null,
            tier,
            attrs,
          }
        : null,
    });
  });
  return results;
}
