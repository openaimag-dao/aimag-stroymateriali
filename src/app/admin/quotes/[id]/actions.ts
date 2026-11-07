"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireStaff } from "@/lib/staff";
import { emailQuoteToBuyer, type EmailResult } from "@/lib/notifications";

const errText: Record<string, string> = {
  invoice_exists: "Счёт уже выставлен — доставку и продавца менять нельзя. Нужен новый КП.",
  bad_delivery_amount: "Проверьте сумму доставки.",
  bad_seller: "Неизвестный продавец.",
  quote_expired: "Срок КП истёк.",
  seller_bank_missing: "У продавца не заполнены банковские реквизиты — заполните в «Реквизиты продавцов».",
};
const text = (m: string) => Object.entries(errText).find(([k]) => m.includes(k))?.[1] ?? m;
const back = (id: string, msg: string) => redirect(`/admin/quotes/${id}?msg=${encodeURIComponent(msg)}`);

export async function updateQuote(quoteId: string, form: FormData) {
  const { supabase } = await requireStaff();
  const delivery = Number(String(form.get("delivery_kzt") ?? "0").replace(/\s/g, "").replace(",", "."));
  const seller = String(form.get("seller") ?? "aimag");
  const { error } = await supabase.rpc("staff_update_quote", { p_quote_id: quoteId, p_delivery_kzt: delivery, p_seller_code: seller });
  revalidatePath(`/admin/quotes/${quoteId}`);
  back(quoteId, error ? text(error.message) : "КП обновлено");
}

const emailText: Record<EmailResult, string> = {
  sent: "письмо с документами отправлено покупателю",
  not_configured: "письма не настроены (RESEND_API_KEY)",
  no_recipient: "письмо не отправлено: у компании не указан email для счетов",
  failed: "письмо отправить не удалось",
};

export async function staffIssueInvoice(quoteId: string) {
  const { supabase } = await requireStaff();
  const { error } = await supabase.rpc("issue_invoice", { p_quote_id: quoteId });
  revalidatePath(`/admin/quotes/${quoteId}`);
  if (error) back(quoteId, text(error.message));
  const sent = await emailQuoteToBuyer(quoteId);
  back(quoteId, `Счёт выставлен; ${emailText[sent]}`);
}

/** Повторно отправить КП (и счёт, если есть) на email для счетов компании — например, после правки доставки. */
export async function staffEmailQuote(quoteId: string) {
  await requireStaff();
  const sent = await emailQuoteToBuyer(quoteId);
  back(quoteId, emailText[sent][0].toUpperCase() + emailText[sent].slice(1));
}

export async function setOrderStatus(quoteId: string, orderId: string, form: FormData) {
  const { supabase } = await requireStaff();
  const { error } = await supabase.rpc("staff_set_order_status", { p_order_id: orderId, p_status: String(form.get("status")) });
  revalidatePath(`/admin/quotes/${quoteId}`);
  back(quoteId, error ? text(error.message) : "Статус обновлён");
}
