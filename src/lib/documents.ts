import "server-only";
import { getSupabase } from "@/lib/supabase/server";

export type DocSeller = {
  name: string;
  bin: string;
  director: string;
  address: string | null;
  bank_name: string | null;
  bik: string | null;
  iban: string | null;
  kbe: string | null;
  knp: string;
  phone: string;
  vat_payer: boolean;
  stamp_url: string | null;
  signature_url: string | null;
};

export type DocCompany = {
  name: string;
  legal_form: string | null;
  bin: string;
  address: string | null;
};

export type DocLine = {
  line_no: number;
  product_id: string | null;
  name: string;
  mark: string | null;
  unit: string;
  qty: number;
  price_kzt: number;
};

export type DocOrder = {
  id: string;
  invoice_number: string | null;
  created_at: string;
  status: string;
  total_kzt: number;
  vat_kzt: number;
};

export type PdfImage = { data: Buffer; format: "png" | "jpg" };

export type QuoteDoc = {
  id: string;
  number: string;
  created_at: string;
  valid_until: string;
  delivery_method: string | null;
  delivery_city: string | null;
  delivery_address: string | null;
  delivery_kzt: number;
  goods_kzt: number;
  total_kzt: number;
  vat_kzt: number;
  company: DocCompany;
  seller: DocSeller;
  lines: DocLine[];
  order: DocOrder | null;
  images?: { stamp?: PdfImage; signature?: PdfImage };
};

const one = <T,>(v: T | T[] | null | undefined): T | null => (Array.isArray(v) ? (v[0] ?? null) : (v ?? null));

/** Loads a КП with everything a document needs. RLS limits it to the buyer's company and staff. */
export async function getQuoteDoc(id: string): Promise<QuoteDoc | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const supabase = await getSupabase();
  if (!supabase) return null;

  const { data, error } = await supabase
    .from("quotes")
    .select(
      `id, number, created_at, valid_until, delivery_method, delivery_city, delivery_address,
       delivery_kzt, goods_kzt, total_kzt, vat_kzt,
       companies(name, legal_form, bin, address),
       sellers(name, bin, director, address, bank_name, bik, iban, kbe, knp, phone, vat_payer, stamp_url, signature_url),
       quote_items(line_no, product_id, name, mark, unit, qty, price_kzt),
       orders(id, invoice_number, created_at, status, total_kzt, vat_kzt)`,
    )
    .eq("id", id)
    .maybeSingle();
  if (error || !data) return null;

  const row = data as Record<string, unknown>;
  const company = one(row.companies as DocCompany | DocCompany[]);
  const seller = one(row.sellers as DocSeller | DocSeller[]);
  if (!company || !seller) return null;

  const lines = ((row.quote_items as DocLine[]) ?? [])
    .map((l) => ({ ...l, qty: Number(l.qty), price_kzt: Number(l.price_kzt) }))
    .sort((a, b) => a.line_no - b.line_no);

  return {
    id: row.id as string,
    number: row.number as string,
    created_at: row.created_at as string,
    valid_until: row.valid_until as string,
    delivery_method: row.delivery_method as string | null,
    delivery_city: row.delivery_city as string | null,
    delivery_address: row.delivery_address as string | null,
    delivery_kzt: Number(row.delivery_kzt),
    goods_kzt: Number(row.goods_kzt),
    total_kzt: Number(row.total_kzt),
    vat_kzt: Number(row.vat_kzt),
    company,
    seller,
    lines,
    order: normalizeOrder(one(row.orders as DocOrder | DocOrder[])),
  };
}

function normalizeOrder(o: DocOrder | null): DocOrder | null {
  return o ? { ...o, total_kzt: Number(o.total_kzt), vat_kzt: Number(o.vat_kzt) } : null;
}

/**
 * Stamp and signature bytes for the PDF. The bucket is private; the visitor's own session reads them
 * (any signed-in user may), and the image is embedded into the PDF rather than linked.
 */
export async function loadSellerImages(seller: DocSeller): Promise<NonNullable<QuoteDoc["images"]>> {
  const supabase = await getSupabase();
  if (!supabase) return {};
  const get = async (path: string | null): Promise<PdfImage | undefined> => {
    if (!path || path.includes("://")) return undefined;
    const { data, error } = await supabase.storage.from("branding").download(path);
    if (error || !data) return undefined;
    return { data: Buffer.from(await data.arrayBuffer()), format: path.toLowerCase().endsWith(".png") ? "png" : "jpg" };
  };
  const [stamp, signature] = await Promise.all([get(seller.stamp_url), get(seller.signature_url)]);
  return { stamp, signature };
}

/** Finds the КП behind an invoice (order id), so the invoice PDF reuses the same snapshot. */
export async function getQuoteIdForOrder(orderId: string): Promise<string | null> {
  if (!/^[0-9a-f-]{36}$/i.test(orderId)) return null;
  const supabase = await getSupabase();
  if (!supabase) return null;
  const { data } = await supabase.from("orders").select("quote_id").eq("id", orderId).maybeSingle();
  return (data?.quote_id as string | undefined) ?? null;
}

/** "2026-11-13" or an ISO timestamp → "13.11.2026" in Almaty time. */
export function formatDocDate(value: string): string {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [y, m, d] = value.split("-");
    return `${d}.${m}.${y}`;
  }
  return new Date(value).toLocaleDateString("ru-RU", { timeZone: "Asia/Almaty" });
}

export const deliveryLabel: Record<string, string> = {
  pickup: "Самовывоз со склада в Шымкенте",
  city: "Доставка по Шымкенту",
  intercity: "Доставка по Казахстану транспортной компанией",
};

/** Short code of a create_quote / issue_invoice error; safe to put in a URL. */
export function documentErrorCode(message: string): string {
  return Object.keys(ERRORS).find((k) => message.includes(k)) ?? "unknown";
}

/** Buyer-facing text for an error message or code (unknown codes get a generic text). */
export function documentErrorText(messageOrCode: string): string {
  return ERRORS[documentErrorCode(messageOrCode)] ?? "Не удалось сформировать документ. Попробуйте ещё раз или позвоните нам.";
}

const ERRORS: Record<string, string> = {
  not_authenticated: "Войдите, чтобы получить документы.",
  no_company: "Сначала укажите данные компании в кабинете.",
  empty_cart: "Корзина пуста.",
  bad_qty: "Проверьте количество в корзине.",
  product_unavailable: "Одна из позиций больше недоступна. Обновите корзину.",
  too_many_lines: "Слишком много позиций в одном КП — разбейте заказ.",
  quote_expired: "Срок действия КП истёк. Сформируйте новое КП из корзины.",
  seller_bank_missing: "Счёт по этому КП выставит менеджер — мы свяжемся с вами.",
  quote_not_found: "КП не найдено.",
};
