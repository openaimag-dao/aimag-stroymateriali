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

export default async function CartPage({ searchParams }: { searchParams: Promise<{ reorder_skipped?: string }> }) {
  const status = await checkoutStatus();
  const skipped = Number((await searchParams).reorder_skipped ?? 0);
  return (
    <div className="container py-8">
      <h1 className="mb-6 font-display text-[34px] font-semibold tracking-tight">Корзина</h1>
      {skipped > 0 && (
        <p role="status" className="mb-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
          Позиции прошлого КП добавлены по текущим ценам. Не добавлено снятых с продажи позиций: {skipped} — список на странице
          КП.
        </p>
      )}
      <CartView status={status} />
    </div>
  );
}
