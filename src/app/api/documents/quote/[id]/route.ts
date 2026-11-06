import { createElement, type ReactElement } from "react";
import { renderToBuffer, type DocumentProps } from "@react-pdf/renderer";
import { getQuoteDoc } from "@/lib/documents";
import { registerFonts } from "@/components/documents/pdf-base";
import { QuotePdf } from "@/components/documents/quote-pdf";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const doc = await getQuoteDoc(id); // RLS: only the buyer's company and staff
  if (!doc) return new Response("Not found", { status: 404 });

  registerFonts();
  const pdf = await renderToBuffer(createElement(QuotePdf, { doc }) as unknown as ReactElement<DocumentProps>);
  const file = `${doc.number}.pdf`;
  return new Response(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${doc.number.replace("КП-", "KP-")}.pdf"; filename*=UTF-8''${encodeURIComponent(file)}`,
      "Cache-Control": "private, no-store",
    },
  });
}
