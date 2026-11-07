"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { z } from "zod";
import { getSupabase } from "@/lib/supabase/server";
import { documentErrorCode, documentErrorText } from "@/lib/documents";
import { emailQuoteToBuyer, notifyStaffAboutQuote } from "@/lib/notifications";

// Only ids and quantities come from the browser; prices are taken from the DB in create_quote.
const schema = z.object({
  items: z
    .array(z.object({ productId: z.string().uuid(), qty: z.number().positive().max(1_000_000) }))
    .min(1)
    .max(200),
  delivery: z.enum(["pickup", "city", "intercity"]),
  city: z.string().trim().max(120).optional(),
  address: z.string().trim().max(300).optional(),
  withInvoice: z.boolean(),
});

export type CheckoutInput = z.infer<typeof schema>;
export type CheckoutResult = { quoteId?: string; invoiceErrorCode?: string; error?: string };

export async function checkout(input: CheckoutInput): Promise<CheckoutResult> {
  const parsed = schema.safeParse(input);
  if (!parsed.success) return { error: "Проверьте корзину: количество должно быть больше нуля." };

  const supabase = await getSupabase();
  if (!supabase) return { error: "База не подключена." };

  const v = parsed.data;
  const { data: quoteId, error } = await supabase.rpc("create_quote", {
    p_items: v.items.map((i) => ({ product_id: i.productId, qty: i.qty })),
    p_delivery_method: v.delivery,
    p_delivery_city: v.city || null,
    p_delivery_address: v.address || null,
  });
  if (error || !quoteId) return { error: documentErrorText(error?.message ?? "") };

  let invoiceErrorCode: string | undefined;
  if (v.withInvoice) {
    const { error: invErr } = await supabase.rpc("issue_invoice", { p_quote_id: quoteId });
    if (invErr) invoiceErrorCode = documentErrorCode(invErr.message);
  }

  // Письма — после ответа, чтобы покупатель не ждал PDF и почту.
  const { data: auth } = await supabase.auth.getUser();
  const id = quoteId as string;
  after(async () => {
    await emailQuoteToBuyer(id, [auth.user?.email]);
    await notifyStaffAboutQuote(id);
  });

  revalidatePath("/account");
  return { quoteId: quoteId as string, invoiceErrorCode };
}
