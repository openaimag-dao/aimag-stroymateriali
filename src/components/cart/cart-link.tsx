"use client";

import Link from "next/link";
import { useCart } from "./cart-provider";

export function CartLink() {
  const { count } = useCart();
  return (
    <Link href="/cart" className="inline-flex items-center gap-1.5 hover:text-signal-800">
      Корзина
      {count > 0 && (
        <span className="inline-flex h-[22px] min-w-[22px] items-center justify-center rounded-full bg-signal px-1.5 text-xs font-bold text-steel-900">
          {count}
          <span className="sr-only"> позиций</span>
        </span>
      )}
    </Link>
  );
}
