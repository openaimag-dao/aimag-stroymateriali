/**
 * Схемы ответов Claude и чистая логика вокруг них: кандидаты с короткими кодами,
 * проверка ответа и строки для save_spec_parse. Без сети — проверяется тестами.
 */
import * as z from "zod/v4";

// ── Шаг 1: позиции из заявки ──
export const ExtractionSchema = z.object({
  summary: z.string().describe("Объект, адрес, сроки, пожелания по доставке из заявки; пустая строка, если ничего нет"),
  items: z.array(
    z.object({
      source_text: z.string().describe("Строка заявки как есть: наименование, марка, размеры, количество"),
      name: z.string().describe("Позиция, приведённая к виду каталога: тип, марка, размер, ГОСТ"),
      search_query: z.string().describe("3–7 ключевых слов для поиска в каталоге: тип товара, марка, размер"),
      qty: z.number().nullable().describe("Количество из заявки; null, если не указано"),
      unit: z.string().nullable().describe("Единица из заявки: м, шт, м², т, кг, упак; null, если не указана"),
    }),
  ),
});
export type Extraction = z.infer<typeof ExtractionSchema>;
export type ExtractedItem = Extraction["items"][number];

// ── Шаг 2: выбор товара из кандидатов ──
export const MatchSchema = z.object({
  matches: z.array(
    z.object({
      line: z.number().describe("Номер позиции из списка"),
      code: z.string().nullable().describe("Код подходящего товара (P1, P2…) из кандидатов этой позиции; null, если подходящего нет"),
      status: z.string().describe("Одно из: found, to_order, not_supplied"),
      qty: z.number().nullable().describe("Количество в единицах выбранного товара; null, если пересчитать однозначно нельзя"),
      confidence: z.number().describe("Уверенность в выборе от 0 до 1"),
      note: z.string().describe("Коротко для менеджера: отличие от заявки, что уточнить; пустая строка, если нечего"),
    }),
  ),
});
export type MatchResult = z.infer<typeof MatchSchema>;

export type Candidate = {
  q: number; // номер запроса (1-based) в spec_candidates
  product_id: string;
  sku: string | null;
  name: string;
  spec: string | null;
  unit: string;
  price_kzt: number;
  in_stock: boolean;
  attrs: string | null;
  rank: number;
};

export type CandidateCatalog = {
  /** код → товар */
  byCode: Map<string, Candidate>;
  /** позиция (1-based) → коды кандидатов, лучшие первыми */
  perLine: Map<number, string[]>;
};

/** На каждую позицию два запроса: ключевые слова и нормализованное название. */
export function candidateQueries(items: ExtractedItem[]): string[] {
  return items.flatMap((i) => [i.search_query || i.name, i.name || i.source_text]);
}

/** Раздаёт товарам короткие коды (P1…) и собирает до perLine кандидатов на позицию. */
export function buildCatalog(items: ExtractedItem[], rows: Candidate[], perLine = 8): CandidateCatalog {
  const byCode = new Map<string, Candidate>();
  const codeOf = new Map<string, string>();
  const lines = new Map<number, string[]>();
  const bestRank = new Map<string, number>(); // `${line}|${code}` → rank

  for (const r of rows) {
    const line = Math.ceil(r.q / 2);
    if (line < 1 || line > items.length) continue;
    let code = codeOf.get(r.product_id);
    if (!code) {
      code = `P${codeOf.size + 1}`;
      codeOf.set(r.product_id, code);
      byCode.set(code, r);
    }
    const key = `${line}|${code}`;
    if (!bestRank.has(key)) {
      bestRank.set(key, r.rank);
      lines.set(line, [...(lines.get(line) ?? []), code]);
    } else if (r.rank > bestRank.get(key)!) bestRank.set(key, r.rank);
  }

  const perLineSorted = new Map<number, string[]>();
  for (const [line, codes] of lines) {
    perLineSorted.set(
      line,
      [...codes].sort((a, b) => bestRank.get(`${line}|${b}`)! - bestRank.get(`${line}|${a}`)!).slice(0, perLine),
    );
  }
  return { byCode, perLine: perLineSorted };
}

/** Текст для шага 2: список товаров один раз и позиции со ссылками на коды. */
export function renderMatchPrompt(items: ExtractedItem[], cat: CandidateCatalog): string {
  const used = new Set([...cat.perLine.values()].flat());
  const products = [...cat.byCode.entries()]
    .filter(([code]) => used.has(code))
    .map(([code, c]) => {
      const details = [c.spec, c.attrs].filter(Boolean).join("; ");
      return `${code}\t${c.name}${details ? ` (${details})` : ""}\tед.: ${c.unit}\t${c.in_stock ? "в наличии" : "под заказ"}`;
    })
    .join("\n");
  const lines = items
    .map((it, i) => {
      const line = i + 1;
      const qty = it.qty !== null ? `${it.qty} ${it.unit ?? ""}`.trim() : "кол-во не указано";
      const codes = cat.perLine.get(line) ?? [];
      return `${line}. ${it.name} — ${qty}\n   из заявки: ${it.source_text}\n   кандидаты: ${codes.length ? codes.join(", ") : "нет"}`;
    })
    .join("\n");
  return `<catalog_candidates>\n${products || "(ничего не нашлось)"}\n</catalog_candidates>\n\n<spec_lines>\n${lines}\n</spec_lines>`;
}

export type SpecItemRow = {
  source_text: string;
  name: string;
  qty: number | null;
  unit: string | null;
  product_id: string | null;
  match_status: "found" | "to_order" | "not_supplied" | "pending";
  confidence: number | null;
  note: string | null;
  candidates: string[];
};

/**
 * Склеивает позиции и ответ шага 2. Код товара принимается, только если он был среди кандидатов
 * этой позиции; иначе позиция уходит менеджеру как «не сопоставлено».
 */
export function toSpecItemRows(items: ExtractedItem[], cat: CandidateCatalog, result: MatchResult | null): SpecItemRow[] {
  const byLine = new Map((result?.matches ?? []).map((m) => [m.line, m]));
  return items.map((it, i) => {
    const line = i + 1;
    const codes = cat.perLine.get(line) ?? [];
    const candidates = codes.map((c) => cat.byCode.get(c)!.product_id);
    const m = byLine.get(line);
    const product = m?.code && codes.includes(m.code) ? cat.byCode.get(m.code)! : null;
    const converted = product && m?.qty !== null && m?.qty !== undefined && m.qty > 0;

    let status: SpecItemRow["match_status"] = "pending";
    if (m?.status === "found" && product) status = "found";
    else if (m?.status === "to_order" || m?.status === "not_supplied") status = m.status;

    const notes = [m?.note?.trim(), m?.code && !product ? `ИИ предложил ${m.code}, которого нет среди кандидатов` : ""].filter(Boolean);
    return {
      source_text: it.source_text,
      name: it.name,
      qty: converted ? m!.qty : it.qty,
      unit: converted ? product!.unit : it.unit,
      product_id: product?.product_id ?? null,
      match_status: status,
      confidence: m && Number.isFinite(m.confidence) ? Math.min(1, Math.max(0, m.confidence)) : null,
      note: notes.join(". ") || null,
      candidates,
    };
  });
}
