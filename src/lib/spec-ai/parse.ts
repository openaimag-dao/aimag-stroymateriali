import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import type * as z from "zod/v4";
import { getSupabase } from "@/lib/supabase/server";
import { buildSpecInput } from "./input";
import {
  ExtractionSchema,
  MatchSchema,
  buildCatalog,
  candidateQueries,
  renderMatchPrompt,
  toSpecItemRows,
  type Candidate,
  type SpecItemRow,
} from "./match";

/**
 * Разбор спецификации ИИ в два шага, которыми управляет код:
 * 1) Claude читает файл и выписывает позиции; 2) база ищет кандидатов в каталоге;
 * 3) Claude выбирает товар из кандидатов каждой позиции. Результат — черновик для менеджера.
 */
export const SPEC_AI_MODEL = "claude-opus-5-5";
const MAX_LINES = 200;

export function isSpecAiConfigured(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

const EXTRACT_SYSTEM = `Ты помогаешь оптовому магазину стройматериалов в Казахстане (Шымкент) разбирать заявки покупателей — ТОО и ИП.
Заявка приходит таблицей, документом, PDF или фото: ведомость объёмов, смета, список «что нужно на объект».

Выпиши каждую позицию материала, которую покупатель хочет купить:
- source_text — строка как в заявке (наименование, марка, размер, количество), без пересказа;
- name — та же позиция в виде строки каталога: тип товара, марка, размер, ГОСТ/ТУ. Раскрывай сокращения (ППР → PP-R, ГКЛ → гипсокартон, д25 → 25 мм), но не придумывай характеристик, которых нет в заявке;
- search_query — 3–7 слов для полнотекстового поиска по каталогу на русском: тип товара и ключевые размеры/марки;
- qty и unit — количество и единица как в заявке. Если количество не указано — null.

Не выписывай работы и услуги (монтаж, доставка, вывоз мусора), итоговые строки, заголовки разделов и строки без материала.
Одинаковые позиции из разных разделов не объединяй — менеджер видит заявку построчно.
В summary коротко перенеси то, что важно для КП: объект, адрес, сроки, пожелания по доставке и оплате.`;

const MATCH_SYSTEM = `Ты сопоставляешь позиции заявки покупателя с товарами каталога оптового магазина стройматериалов.
Для каждой позиции есть кандидаты из полнотекстового поиска — коды P1, P2… Выбирать можно только из кандидатов этой позиции.

status:
- found — среди кандидатов есть товар, который покупатель может взять вместо строки заявки: совпадают тип, размер/сечение/толщина и марка, если она указана. Мелкие отличия (производитель, цвет не указан в заявке) допустимы — опиши их в note;
- to_order — подходящего товара среди кандидатов нет, но это стройматериал, который магазин может привезти под заказ;
- not_supplied — это не стройматериал (работы, техника, услуги) или позицию нельзя понять.

qty — количество в единицах выбранного товара. Пересчитывай только однозначные случаи (единицы совпадают; «3 бухты по 100 м» → 300 м). Если единицы разные и пересчёт требует данных, которых нет (т ↔ м арматуры без диаметра, м² ↔ листы без размера), верни null и напиши в note, что пересчитать.
confidence — насколько ты уверен, что менеджеру не придётся менять товар: 0.9+ точное совпадение, 0.6–0.9 похоже, но есть отличия, ниже — сомнительно.
note пиши по-русски, коротко, только если есть что проверить. Ответ — по одной записи на каждую позицию, в том же порядке.`;

type Parsed<T> = { ok: true; value: T } | { ok: false; reason: string };

async function ask<S extends z.ZodType>(
  client: Anthropic,
  system: string,
  content: Anthropic.Beta.BetaContentBlockParam[],
  schema: S,
): Promise<Parsed<z.infer<S>>> {
  const stream = client.beta.messages.stream({
    model: SPEC_AI_MODEL,
    max_tokens: 64000,
    system,
    messages: [{ role: "user", content }],
    output_config: { effort: "medium", format: betaZodOutputFormat(schema) },
    // при отказе классификатора безопасности запрос повторяется на рекомендованной модели
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
  });
  const msg = await stream.finalMessage();
  if (msg.stop_reason === "refusal") return { ok: false, reason: "ИИ отказался разбирать файл" };
  if (msg.stop_reason === "max_tokens") return { ok: false, reason: "Заявка слишком длинная для одного разбора" };
  if (!msg.parsed_output) return { ok: false, reason: "ИИ вернул ответ не по формату" };
  return { ok: true, value: msg.parsed_output as z.infer<S> };
}

export type ParseOutcome = { status: "done" | "failed" | "skipped"; lines: number; found: number; error?: string };

/**
 * Разбирает спецификацию и сохраняет результат через save_spec_parse — сессией текущего пользователя
 * (покупатель — один раз сразу после загрузки, менеджер — повторно из админки).
 */
export async function parseSpec(specId: string): Promise<ParseOutcome> {
  const supabase = await getSupabase();
  if (!supabase) return { status: "failed", lines: 0, found: 0, error: "База не подключена" };

  const save = async (status: ParseOutcome["status"], rows: SpecItemRow[], error?: string, summary?: string) => {
    const { error: dbErr } = await supabase.rpc("save_spec_parse", {
      p_spec_id: specId,
      p_items: rows,
      p_status: status,
      p_model: status === "done" ? SPEC_AI_MODEL : null,
      p_error: error ?? null,
      p_summary: summary || null,
    });
    if (dbErr) console.error("spec-ai: save failed", specId, dbErr.message);
    return { status, lines: rows.length, found: rows.filter((r) => r.match_status === "found").length, error };
  };

  if (!isSpecAiConfigured()) return save("skipped", [], "ИИ не настроен (ANTHROPIC_API_KEY) — разбор вручную");

  const { data: spec } = await supabase.from("specs").select("file_path, file_name").eq("id", specId).maybeSingle();
  if (!spec) return { status: "failed", lines: 0, found: 0, error: "Спецификация не найдена" };

  const { data: file, error: dlErr } = await supabase.storage.from("specs").download(spec.file_path as string);
  if (dlErr || !file) return save("failed", [], "Не удалось скачать файл из хранилища");

  const input = await buildSpecInput(spec.file_name as string, await file.arrayBuffer());
  if (!input.ok) return save("skipped", [], input.reason);

  try {
    const client = new Anthropic();

    // 1) позиции из заявки
    const extracted = await ask(
      client,
      EXTRACT_SYSTEM,
      [...input.blocks, { type: "text", text: `Файл: «${spec.file_name}». Выпиши позиции материалов из этой заявки.` }],
      ExtractionSchema,
    );
    if (!extracted.ok) return save("failed", [], extracted.reason);
    const { items, summary } = extracted.value;
    if (items.length === 0) return save("done", [], "В файле не нашлось позиций материалов", summary);
    if (items.length > MAX_LINES) {
      return save("skipped", [], `В заявке ${items.length} позиций — больше ${MAX_LINES}, разбор вручную или частями`, summary);
    }

    // 2) кандидаты из каталога
    const { data: cands, error: candErr } = await supabase.rpc("spec_candidates", {
      p_queries: candidateQueries(items),
      p_limit: 6,
    });
    if (candErr) return save("failed", [], "Не удалось найти товары в каталоге", summary);
    const catalog = buildCatalog(
      items,
      ((cands ?? []) as Candidate[]).map((c) => ({ ...c, price_kzt: Number(c.price_kzt), rank: Number(c.rank) })),
    );

    // 3) выбор товара — только если есть из чего выбирать
    let matched: Parsed<z.infer<typeof MatchSchema>> | null = null;
    if (catalog.byCode.size > 0) {
      matched = await ask(client, MATCH_SYSTEM, [{ type: "text", text: renderMatchPrompt(items, catalog) }], MatchSchema);
    }
    const rows = toSpecItemRows(items, catalog, matched?.ok ? matched.value : null);
    const error = matched && !matched.ok ? `Позиции выписаны, но не сопоставлены: ${matched.reason}` : undefined;
    return save("done", rows, error, summary);
  } catch (e) {
    console.error("spec-ai: parse failed", specId, e);
    const reason =
      e instanceof Anthropic.RateLimitError
        ? "ИИ перегружен — повторите разбор позже"
        : e instanceof Anthropic.AuthenticationError
          ? "Неверный ключ ANTHROPIC_API_KEY"
          : e instanceof Anthropic.APIError
            ? `Ошибка ИИ (${e.status ?? "сеть"})`
            : "Разбор прервался";
    return save("failed", [], reason);
  }
}
