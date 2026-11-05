import type { Metadata } from "next";
import { CartView } from "@/components/cart/cart-view";

export const metadata: Metadata = { title: "Корзина" };

export default function CartPage() {
  return (
    <div className="container py-8">
      <h1 className="mb-6 font-display text-[34px] font-semibold tracking-tight">Корзина</h1>
      <CartView />
    </div>
  );
}
