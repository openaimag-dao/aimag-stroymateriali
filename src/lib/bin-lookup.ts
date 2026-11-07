/**
 * Реквизиты компании по БИН/ИИН из открытого реестра Бюро национальной статистики (stat.gov.kz).
 * Разбор ответа — чистая функция (её проверяют тесты), сам запрос — в lookupBin.
 */

export type LegalForm = "ТОО" | "ИП" | "АО" | "Другое";

export type BinInfo = {
  bin: string;
  name: string;
  legalForm: LegalForm;
  director: string | null;
  address: string | null;
  oked: string | null;
  registeredAt: string | null; // YYYY-MM-DD
};

/** Адрес можно переопределить (например, прокси в Казахстане), если реестр не отвечает из региона сервера. */
export const BIN_LOOKUP_URL =
  process.env.BIN_LOOKUP_URL ?? "https://old.stat.gov.kz/api/juridical/counter/api/?lang=ru&bin={bin}";

const FORMS: { form: LegalForm; prefixes: string[] }[] = [
  { form: "ТОО", prefixes: ["товарищество с ограниченной ответственностью", "тоо"] },
  { form: "АО", prefixes: ["акционерное общество", "ао"] },
  { form: "ИП", prefixes: ["индивидуальный предприниматель", "ип"] },
];

const QUOTES = /^[\s"«»“”„']+|[\s"«»“”„']+$/g;

/** «ТОО "Ромашка"» → { form: "ТОО", name: "Ромашка" }. Название хранится без формы — её дописывают документы. */
export function splitLegalForm(fullName: string, isIp = false): { legalForm: LegalForm; name: string } {
  const src = fullName.replace(/\s+/g, " ").trim();
  const lower = src.toLowerCase();
  for (const { form, prefixes } of FORMS) {
    for (const p of prefixes) {
      if (lower.startsWith(p) && (lower.length === p.length || /[\s"«“„']/.test(lower[p.length]))) {
        const rest = src.slice(p.length).replace(QUOTES, "").trim();
        if (rest) return { legalForm: form, name: rest };
      }
    }
  }
  return { legalForm: isIp ? "ИП" : "Другое", name: src.replace(QUOTES, "").trim() };
}

const str = (v: unknown): string | null => (typeof v === "string" && v.trim() ? v.replace(/\s+/g, " ").trim() : null);

/** Разбирает ответ реестра; null — если компания не найдена или ответ не похож на ожидаемый. */
export function parseStatGovResponse(json: unknown, bin: string): BinInfo | null {
  if (!json || typeof json !== "object") return null;
  const root = json as Record<string, unknown>;
  if (root.success === false) return null;
  const obj = (root.obj ?? root) as Record<string, unknown> | null;
  if (!obj || typeof obj !== "object") return null;

  const fullName = str(obj.name);
  if (!fullName) return null;
  if (str(obj.bin) && str(obj.bin) !== bin) return null;

  const { legalForm, name } = splitLegalForm(fullName, obj.ip === true);
  const reg = str(obj.registerDate);
  return {
    bin,
    name,
    legalForm,
    director: str(obj.fio),
    address: str(obj.katoAddress),
    oked: str(obj.okedCode),
    registeredAt: reg && /^\d{4}-\d{2}-\d{2}/.test(reg) ? reg.slice(0, 10) : null,
  };
}

export type BinLookupResult = { ok: true; info: BinInfo } | { ok: false; reason: "not_found" | "unavailable" };

export async function lookupBin(bin: string, timeoutMs = 6000): Promise<BinLookupResult> {
  const url = BIN_LOOKUP_URL.replace("{bin}", encodeURIComponent(bin));
  try {
    const res = await fetch(url, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(timeoutMs),
      cache: "no-store",
    });
    if (res.status === 404) return { ok: false, reason: "not_found" };
    if (!res.ok) return { ok: false, reason: "unavailable" };
    const json: unknown = await res.json().catch(() => null);
    if (json === null) return { ok: false, reason: "unavailable" };
    const info = parseStatGovResponse(json, bin);
    return info ? { ok: true, info } : { ok: false, reason: "not_found" };
  } catch {
    return { ok: false, reason: "unavailable" };
  }
}
