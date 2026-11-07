import { getQuoteDoc } from "@/lib/documents";
import { pdfFileNames, renderQuotePdf } from "@/lib/pdf";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const doc = await getQuoteDoc(id); // RLS: only the buyer's company and staff
  if (!doc) return new Response("Not found", { status: 404 });

  const pdf = await renderQuotePdf(doc);
  const f = pdfFileNames(doc, "quote");
  return new Response(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${f.ascii}"; filename*=UTF-8''${encodeURIComponent(f.utf8)}`,
      "Cache-Control": "private, no-store",
    },
  });
}
