import "server-only";
import { createElement, type ReactElement } from "react";
import { renderToBuffer, type DocumentProps } from "@react-pdf/renderer";
import { loadSellerImages, type QuoteDoc } from "@/lib/documents";
import { registerFonts } from "@/components/documents/pdf-base";
import { QuotePdf } from "@/components/documents/quote-pdf";
import { InvoicePdf } from "@/components/documents/invoice-pdf";

async function render(doc: QuoteDoc, kind: "quote" | "invoice"): Promise<Buffer> {
  doc.images ??= await loadSellerImages(doc.seller);
  registerFonts();
  const el = createElement(kind === "quote" ? QuotePdf : InvoicePdf, { doc });
  return renderToBuffer(el as unknown as ReactElement<DocumentProps>);
}

export const renderQuotePdf = (doc: QuoteDoc) => render(doc, "quote");
export const renderInvoicePdf = (doc: QuoteDoc) => render(doc, "invoice");

/** Имя файла латиницей (для старых почтовых клиентов) и по-русски. */
export function pdfFileNames(doc: QuoteDoc, kind: "quote" | "invoice") {
  if (kind === "quote") return { ascii: `${doc.number.replace("КП-", "KP-")}.pdf`, utf8: `${doc.number}.pdf` };
  const n = doc.order?.invoice_number ?? "";
  return { ascii: `invoice-${n}.pdf`, utf8: `Счёт ${n}.pdf` };
}
