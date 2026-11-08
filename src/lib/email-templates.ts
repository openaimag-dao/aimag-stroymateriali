/**
 * Тексты писем покупателю и менеджеру. Чистые функции без сети — их проверяют тесты.
 */
import { formatTenge } from "@/lib/money";
import { siteConfig } from "@/config/site";

export type EmailContent = { subject: string; text: string; html: string };

export type DocEmailInput = {
  quoteNumber: string;
  validUntil: string; // "13.11.2026"
  totalKzt: number;
  companyTitle: string; // ТОО «Ромашка»
  invoiceNumber: string | null; // есть — письмо про счёт
  sellerName: string;
  accountUrl: string; // ссылка на КП в кабинете
};

export function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

function layout(title: string, paragraphs: string[], link?: { url: string; label: string }): string {
  const body = paragraphs.map((p) => `<p style="margin:0 0 12px">${escapeHtml(p)}</p>`).join("");
  const button = link
    ? `<p style="margin:20px 0"><a href="${escapeHtml(link.url)}" style="background:#ffb300;color:#0e1622;padding:12px 20px;border-radius:8px;text-decoration:none;font-weight:600">${escapeHtml(link.label)}</a></p>`
    : "";
  return `<!doctype html><html lang="ru"><body style="margin:0;background:#f3f5f8;font-family:Inter,Arial,sans-serif;color:#0e1622">
<div style="max-width:560px;margin:0 auto;padding:24px">
<div style="background:#fff;border-radius:12px;padding:28px">
<p style="margin:0 0 16px;font-weight:700;font-size:18px">${escapeHtml(siteConfig.name)}</p>
<h1 style="margin:0 0 16px;font-size:20px">${escapeHtml(title)}</h1>
${body}${button}
<p style="margin:20px 0 0;color:#4d6580;font-size:14px">Вопросы — ${escapeHtml(siteConfig.phone)}, ${escapeHtml(siteConfig.email)}</p>
</div></div></body></html>`;
}

export function documentEmail(d: DocEmailInput): EmailContent {
  const total = formatTenge(d.totalKzt);
  const isInvoice = Boolean(d.invoiceNumber);
  const subject = isInvoice
    ? `Счёт на оплату № ${d.invoiceNumber} — ${total}`
    : `Коммерческое предложение ${d.quoteNumber} — ${total}`;
  const title = isInvoice ? `Счёт № ${d.invoiceNumber} для ${d.companyTitle}` : `КП ${d.quoteNumber} для ${d.companyTitle}`;
  const paragraphs = isInvoice
    ? [
        `Во вложении счёт на оплату № ${d.invoiceNumber} от ${d.sellerName} и коммерческое предложение ${d.quoteNumber}.`,
        `Сумма к оплате: ${total}, в том числе НДС ${siteConfig.vatPct}%.`,
        "После оплаты пришлите, пожалуйста, платёжное поручение — так отгрузим быстрее.",
      ]
    : [
        `Во вложении коммерческое предложение ${d.quoteNumber} на сумму ${total} с НДС ${siteConfig.vatPct}%.`,
        `Цены зафиксированы до ${d.validUntil}. Счёт на оплату можно выставить в кабинете одной кнопкой.`,
      ];
  const link = { url: d.accountUrl, label: isInvoice ? "Открыть в кабинете" : "Открыть КП и выставить счёт" };
  const text = [title, "", ...paragraphs, "", `${link.label}: ${link.url}`, "", `${siteConfig.phone} · ${siteConfig.email}`].join("\n");
  return { subject, text, html: layout(title, paragraphs, link) };
}

export function staffQuoteEmail(d: DocEmailInput & { adminUrl: string }): EmailContent {
  const what = d.invoiceNumber ? `КП ${d.quoteNumber} и счёт № ${d.invoiceNumber}` : `КП ${d.quoteNumber}`;
  const subject = `Новое ${what} — ${d.companyTitle}, ${formatTenge(d.totalKzt)}`;
  const paragraphs = [`${d.companyTitle} сформировал ${what} на ${formatTenge(d.totalKzt)}.`, "Проверьте доставку и продавца."];
  const text = [subject, "", ...paragraphs, "", d.adminUrl].join("\n");
  return { subject, text, html: layout(subject, paragraphs, { url: d.adminUrl, label: "Открыть в админке" }) };
}

export function staffSpecEmail(d: { companyTitle: string; fileName: string; adminUrl: string }): EmailContent {
  const subject = `Новая спецификация — ${d.companyTitle}`;
  const paragraphs = [
    `${d.companyTitle} загрузил спецификацию «${d.fileName}».`,
    `Ответить с КП нужно в течение ${siteConfig.specResponseMinutes} минут в рабочее время.`,
  ];
  const text = [subject, "", ...paragraphs, "", d.adminUrl].join("\n");
  return { subject, text, html: layout(subject, paragraphs, { url: d.adminUrl, label: "Открыть спецификации" }) };
}

export function inviteEmail(d: { companyTitle: string; role: string; loginUrl: string; email: string }): EmailContent {
  const subject = `Приглашение в кабинет ${d.companyTitle} — ${siteConfig.name}`;
  const paragraphs = [
    `Вас добавили в кабинет ${d.companyTitle} как ${d.role}.`,
    `Войдите на сайт с адресом ${d.email} — ссылка для входа придёт на эту почту, пароль не нужен. В кабинете нажмите «Присоединиться».`,
    "После этого вам будут доступны оптовые цены, корзина, КП и счета компании.",
  ];
  const text = [subject, "", ...paragraphs, "", d.loginUrl].join("\n");
  return { subject, text, html: layout(subject, paragraphs, { url: d.loginUrl, label: "Войти и присоединиться" }) };
}

const ORDER_STATUS_TEXT: Record<string, { title: string; body: string }> = {
  paid: { title: "Оплата получена", body: "Мы получили оплату и готовим заказ к отгрузке." },
  shipped: { title: "Заказ отгружен", body: "Заказ отгружен со склада и едет к вам." },
  delivered: { title: "Заказ доставлен", body: "Заказ доставлен. Спасибо, что работаете с нами!" },
  cancelled: { title: "Заказ отменён", body: "Заказ отменён. Если это ошибка — позвоните нам." },
};

/** Письмо покупателю о смене статуса заказа; null — для статусов, о которых не пишем. */
export function orderStatusEmail(d: { status: string; invoiceNumber: string; totalKzt: number; accountUrl: string }): EmailContent | null {
  const t = ORDER_STATUS_TEXT[d.status];
  if (!t) return null;
  const subject = `${t.title}: счёт № ${d.invoiceNumber}`;
  const paragraphs = [t.body, `Счёт № ${d.invoiceNumber} на ${formatTenge(d.totalKzt)}.`];
  const text = [subject, "", ...paragraphs, "", d.accountUrl].join("\n");
  return { subject, text, html: layout(subject, paragraphs, { url: d.accountUrl, label: "Открыть в кабинете" }) };
}
