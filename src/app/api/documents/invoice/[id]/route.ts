import { getQuoteDoc, getQuoteIdForOrder } from "@/lib/documents";
import { pdfFileNames, renderInvoicePdf } from "@/lib/pdf";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params; // order id
  const quoteId = await getQuoteIdForOrder(id); // RLS: only the buyer's company and staff
  const doc = quoteId ? await getQuoteDoc(quoteId) : null;
  if (!doc || !doc.order?.invoice_number) return new Response("Not found", { status: 404 });

  const pdf = await renderInvoicePdf(doc);
  const f = pdfFileNames(doc, "invoice");
  return new Response(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${f.ascii}"; filename*=UTF-8''${encodeURIComponent(f.utf8)}`,
      "Cache-Control": "private, no-store",
    },
  });
}
