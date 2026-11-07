import { describe, expect, it } from "vitest";
import { documentEmail, escapeHtml, staffSpecEmail } from "./email-templates";
import { formatTenge } from "./money";

const base = {
  quoteNumber: "КП-261107-01",
  validUntil: "14.11.2026",
  totalKzt: 1234567,
  companyTitle: "ТОО «Ромашка»",
  invoiceNumber: null,
  sellerName: "ИП AIMAG",
  accountUrl: "https://example.kz/account/quotes/1",
};

describe("documentEmail", () => {
  it("describes a КП with validity date and link", () => {
    const e = documentEmail(base);
    expect(e.subject).toBe(`Коммерческое предложение КП-261107-01 — ${formatTenge(1234567)}`);
    expect(e.text).toContain("до 14.11.2026");
    expect(e.text).toContain(base.accountUrl);
    expect(e.html).toContain('href="https://example.kz/account/quotes/1"');
  });

  it("switches to the invoice wording when an invoice exists", () => {
    const e = documentEmail({ ...base, invoiceNumber: "261107-03" });
    expect(e.subject).toBe(`Счёт на оплату № 261107-03 — ${formatTenge(1234567)}`);
    expect(e.text).toContain("от ИП AIMAG");
  });

  it("escapes buyer-provided names in HTML", () => {
    const e = documentEmail({ ...base, companyTitle: 'ТОО «<script>"x"</script>»' });
    expect(e.html).not.toContain("<script>");
    expect(e.html).toContain("&lt;script&gt;&quot;x&quot;");
  });
});

describe("staffSpecEmail", () => {
  it("names the company and file", () => {
    const e = staffSpecEmail({ companyTitle: "ИП «Сауле»", fileName: "заявка.xlsx", adminUrl: "https://x/admin/specs" });
    expect(e.subject).toBe("Новая спецификация — ИП «Сауле»");
    expect(e.text).toContain("«заявка.xlsx»");
  });
});

it("escapeHtml handles all special characters", () => {
  expect(escapeHtml(`&<>"'`)).toBe("&amp;&lt;&gt;&quot;&#39;");
});
