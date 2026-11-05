"use client";

import { useState } from "react";
import { Check } from "lucide-react";
import { useCart } from "./cart-provider";

type Props = { productId: string; name: string; unit: string; priceKzt: number; defaultQty?: number };

export function AddToCart({ productId, name, unit, priceKzt, defaultQty = 1 }: Props) {
  const { add } = useCart();
  const [qty, setQty] = useState(defaultQty);
  const [added, setAdded] = useState(false);
  const inputId = `qty-${productId}`;

  return (
    <div className="flex items-center gap-2.5">
      <label htmlFor={inputId} className="text-[13px] text-muted-foreground">
        Кол-во, {unit}
      </label>
      <input
        id={inputId}
        type="number"
        min={1}
        value={qty}
        onChange={(e) => setQty(Math.max(1, Number(e.target.value) || 1))}
        className="field w-24"
      />
      <button
        type="button"
        className="btn-signal"
        onClick={() => {
          add({ productId, name, unit, priceKzt, qty });
          setAdded(true);
          setTimeout(() => setAdded(false), 1500);
        }}
      >
        {added ? (
          <>
            <Check className="h-4 w-4" aria-hidden="true" /> Добавлено
          </>
        ) : (
          "В корзину"
        )}
      </button>
    </div>
  );
}
