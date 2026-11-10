"use client";

import { useRouter } from "next/navigation";
import { RotateCcw } from "lucide-react";
import { useCart } from "./cart-provider";
import type { ReorderItem } from "@/lib/reorder";

/** Кладёт позиции прошлого КП в корзину (к тому, что там уже есть) и открывает корзину. */
export function ReorderButton({ items, unavailable, primary }: { items: ReorderItem[]; unavailable: string[]; primary?: boolean }) {
  const { add } = useCart();
  const router = useRouter();
  if (items.length === 0) return null;
  return (
    <button
      type="button"
      className={primary ? "btn-signal" : "btn-outline"}
      title={unavailable.length ? `Не попадут в корзину (сняты с продажи): ${unavailable.join(", ")}` : undefined}
      onClick={() => {
        items.forEach((i) => add(i));
        const q = unavailable.length ? `?reorder_skipped=${unavailable.length}` : "";
        router.push(`/cart${q}`);
      }}
    >
      <RotateCcw className="h-[18px] w-[18px]" aria-hidden="true" /> Заказать снова
    </button>
  );
}
