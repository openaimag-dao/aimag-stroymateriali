"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getSupabase } from "@/lib/supabase/server";
import { documentErrorCode } from "@/lib/documents";

export async function issueInvoice(quoteId: string) {
  const supabase = await getSupabase();
  if (!supabase) redirect("/login");
  const { error } = await supabase.rpc("issue_invoice", { p_quote_id: quoteId });
  revalidatePath(`/account/quotes/${quoteId}`);
  revalidatePath("/account");
  if (error) redirect(`/account/quotes/${quoteId}?invoice_error=${documentErrorCode(error.message)}`);
  redirect(`/account/quotes/${quoteId}`);
}
