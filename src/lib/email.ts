import "server-only";
import type { EmailContent } from "@/lib/email-templates";

/**
 * Отправка писем через Resend (https://resend.com). Без RESEND_API_KEY письма не уходят,
 * а сайт работает как раньше — документы остаются в кабинете.
 */
export type Attachment = { filename: string; content: Buffer };

export const emailFrom = process.env.EMAIL_FROM ?? "AIMAG Stroymateriali <sales@aimag.kz>";
/** Куда слать уведомления менеджеру; через запятую можно несколько адресов. */
export const salesNotifyEmails = (process.env.SALES_NOTIFY_EMAIL ?? "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

export function isEmailConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY);
}

const EMAIL_RE = /^[^\s@<>,;]+@[^\s@<>,;]+\.[^\s@<>,;]+$/;

export async function sendEmail(to: string[], content: EmailContent, attachments: Attachment[] = []): Promise<boolean> {
  const key = process.env.RESEND_API_KEY;
  const recipients = [...new Set(to.map((t) => t.trim().toLowerCase()).filter((t) => EMAIL_RE.test(t)))];
  if (!key || recipients.length === 0) return false;
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: emailFrom,
        to: recipients,
        subject: content.subject,
        text: content.text,
        html: content.html,
        attachments: attachments.map((a) => ({ filename: a.filename, content: a.content.toString("base64") })),
      }),
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) console.error("email: resend responded", res.status, await res.text().catch(() => ""));
    return res.ok;
  } catch (e) {
    console.error("email: send failed", e);
    return false;
  }
}
