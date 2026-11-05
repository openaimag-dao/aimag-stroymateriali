"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

export type CartItem = {
  productId: string;
  name: string;
  unit: string;
  priceKzt: number; // base price with VAT; tiers are applied server-side when the КП is issued
  qty: number;
};

type CartCtx = {
  items: CartItem[];
  count: number;
  add: (item: CartItem) => void;
  setQty: (productId: string, qty: number) => void;
  remove: (productId: string) => void;
  clear: () => void;
};

const KEY = "aimag-stroy-cart-v1";
const Ctx = createContext<CartCtx | null>(null);

function load(): CartItem[] {
  try {
    const raw = localStorage.getItem(KEY);
    const parsed = raw ? (JSON.parse(raw) as CartItem[]) : [];
    return Array.isArray(parsed) ? parsed.filter((i) => i && i.productId && i.qty > 0) : [];
  } catch {
    return [];
  }
}

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);

  useEffect(() => setItems(load()), []);
  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(items));
    } catch {
      /* storage blocked: cart lives for this tab only */
    }
  }, [items]);

  const add = useCallback((item: CartItem) => {
    setItems((prev) => {
      const found = prev.find((p) => p.productId === item.productId);
      if (!found) return [...prev, item];
      return prev.map((p) => (p.productId === item.productId ? { ...p, qty: p.qty + item.qty } : p));
    });
  }, []);
  const setQty = useCallback((productId: string, qty: number) => {
    setItems((prev) => prev.map((p) => (p.productId === productId ? { ...p, qty: Math.max(1, qty) } : p)));
  }, []);
  const remove = useCallback((productId: string) => setItems((prev) => prev.filter((p) => p.productId !== productId)), []);
  const clear = useCallback(() => setItems([]), []);

  const value = useMemo(
    () => ({ items, count: items.length, add, setQty, remove, clear }),
    [items, add, setQty, remove, clear],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useCart() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useCart must be used inside CartProvider");
  return ctx;
}
