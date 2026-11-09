import "server-only";
import { getQuoteDoc, formatDocDate, type QuoteDoc } from "@/lib/documents";
import { companyTitle } from "@/lib/company-title";
import { documentEmail, inviteEmail, orderStatusEmail, staffQuoteEmail, staffSpecEmail, type DocEmailInput } from "@/lib/email-templates";
import { isEmailConfigured, salesNotifyEmails, sendEmail, type Attachment } from "@/lib/email";
import { pdfFileNames, renderInvoicePdf, renderQuotePdf } from "@/lib/pdf";
import { getSupabase } from "@/lib/supabase/server";

const siteUrl = () => (process.env.NEXT_PUBLIC_SITE_URL ?? "").replace(/\/$/, "");

function emailInput(doc: QuoteDoc): DocEmailInput {
  return {
    quoteNumber: doc.number,
    validUntil: formatDocDate(doc.valid_until),
    totalKzt: doc.total_kzt,
    companyTitle: companyTitle(doc.company),
    invoiceNumber: doc.order?.invoice_number ?? null,
    sellerName: doc.seller.name,
    accountUrl: `${siteUrl()}/account/quotes/${doc.id}`,
  };
}

/** invoice_email компании (видна покупателю и персоналу по RLS). */
async function companyInvoiceEmail(quoteId: string): Promise<string | null> {
  const supabase = await getSupabase();
  if (!supabase) return null;
  const { data } = await supabase.from("quotes").select("companies(invoice_email)").eq("id", quoteId).maybeSingle();
  const c = (data as { companies?: { invoice_email: string | null } | { invoice_email: string | null }[] } | null)?.companies;
  return (Array.isArray(c) ? c[0]?.invoice_email : c?.invoice_email) ?? null;
}

export type EmailResult = "sent" | "not_configured" | "no_recipient" | "failed";

/**
 * Письмо покупателю с КП (и счётом, если он выставлен) во вложении.
 * Получатели — email для счетов компании и extraTo (например, email вошедшего покупателя).
 */
export async function emailQuoteToBuyer(quoteId: string, extraTo: (string | null | undefined)[] = []): Promise<EmailResult> {
  if (!isEmailConfigured()) return "not_configured";
  const doc = await getQuoteDoc(quoteId);
  if (!doc) return "failed";
  const to = [await companyInvoiceEmail(quoteId), ...extraTo].filter((x): x is string => Boolean(x));
  if (to.length === 0) return "no_recipient";

  const attachments: Attachment[] = [];
  if (doc.order?.invoice_number) {
    attachments.push({ filename: pdfFileNames(doc, "invoice").utf8, content: await renderInvoicePdf(doc) });
  }
  attachments.push({ filename: pdfFileNames(doc, "quote").utf8, content: await renderQuotePdf(doc) });
  return (await sendEmail(to, documentEmail(emailInput(doc)), attachments)) ? "sent" : "failed";
}

/** Уведомление менеджеру о новом КП / счёте, без вложений. */
export async function notifyStaffAboutQuote(quoteId: string): Promise<void> {
  if (!isEmailConfigured() || salesNotifyEmails.length === 0) return;
  const doc = await getQuoteDoc(quoteId);
  if (!doc) return;
  await sendEmail(salesNotifyEmails, staffQuoteEmail({ ...emailInput(doc), adminUrl: `${siteUrl()}/admin/quotes/${doc.id}` }));
}

export async function notifyStaffAboutSpec(company: { name: string; legal_form: string | null }, fileName: string): Promise<void> {
  if (!isEmailConfigured() || salesNotifyEmails.length === 0) return;
  await sendEmail(salesNotifyEmails, staffSpecEmail({ companyTitle: companyTitle(company), fileName, adminUrl: `${siteUrl()}/admin/specs` }));
}

const roleLabel: Record<string, string> = { buyer: "закупщика", accountant: "бухгалтера" };

/** Приглашение сотруднику: войти с этим email и нажать «Присоединиться». */
export async function emailInvite(email: string, role: string, company: { name: string; legal_form: string | null }): Promise<EmailResult> {
  if (!isEmailConfigured()) return "not_configured";
  const ok = await sendEmail(
    [email],
    inviteEmail({ companyTitle: companyTitle(company), role: roleLabel[role] ?? "сотрудника", email, loginUrl: `${siteUrl()}/login?next=/account` }),
  );
  return ok ? "sent" : "failed";
}

/** Покупателю — о смене статуса заказа (оплачен, отгружен, доставлен, отменён). */
export async function emailOrderStatus(quoteId: string, status: string): Promise<EmailResult> {
  if (!isEmailConfigured()) return "not_configured";
  const doc = await getQuoteDoc(quoteId);
  if (!doc?.order?.invoice_number) return "failed";
  const content = orderStatusEmail({
    status,
    invoiceNumber: doc.order.invoice_number,
    totalKzt: doc.order.total_kzt,
    accountUrl: `${siteUrl()}/account/quotes/${doc.id}`,
  });
  if (!content) return "not_configured";
  const to = await companyInvoiceEmail(quoteId);
  if (!to) return "no_recipient";
  return (await sendEmail([to], content)) ? "sent" : "failed";
}
