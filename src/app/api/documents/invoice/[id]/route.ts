import { createElement, type ReactElement } from "react";
import { renderToBuffer, type DocumentProps } from "@react-pdf/renderer";
import { getQuoteDoc, getQuoteIdForOrder } from "@/lib/documents";
import { registerFonts } from "@/components/documents/pdf-base";
import { InvoicePdf } from "@/components/documents/invoice-pdf";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params; // order id
  const quoteId = await getQuoteIdForOrder(id); // RLS: only the buyer's company and staff
  const doc = quoteId ? await getQuoteDoc(quoteId) : null;
  if (!doc || !doc.order?.invoice_number) return new Response("Not found", { status: 404 });

  registerFonts();
  const pdf = await renderToBuffer(createElement(InvoicePdf, { doc }) as unknown as ReactElement<DocumentProps>);
  const file = `Счёт ${doc.order.invoice_number}.pdf`;
  return new Response(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="invoice-${doc.order.invoice_number}.pdf"; filename*=UTF-8''${encodeURIComponent(file)}`,
      "Cache-Control": "private, no-store",
    },
  });
}
