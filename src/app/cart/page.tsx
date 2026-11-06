import type { Metadata } from "next";
import { CartView, type CheckoutStatus } from "@/components/cart/cart-view";
import { getSupabase } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Корзина" };
export const dynamic = "force-dynamic";

async function checkoutStatus(): Promise<CheckoutStatus> {
  const supabase = await getSupabase();
  if (!supabase) return "guest";
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return "guest";
  const { data: company } = await supabase.from("companies").select("id").limit(1).maybeSingle();
  return company ? "ready" : "no_company";
}

export default async function CartPage() {
  const status = await checkoutStatus();
  return (
    <div className="container py-8">
      <h1 className="mb-6 font-display text-[34px] font-semibold tracking-tight">Корзина</h1>
      <CartView status={status} />
    </div>
  );
}
