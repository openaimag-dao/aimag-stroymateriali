import Link from "next/link";
import type { Metadata } from "next";
import { categories } from "@/config/site";
import { listProducts } from "@/lib/catalog";
import { ProductList } from "@/components/catalog/product-list";
import { CategoryIcon } from "@/components/catalog/category-icon";

export const metadata: Metadata = { title: "Каталог" };
export const dynamic = "force-dynamic";

export default async function CatalogPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q } = await searchParams;

  if (q) {
    const result = await listProducts({ q });
    return (
      <div className="container py-8">
        <h1 className="mb-6 font-display text-3xl font-semibold">Поиск: «{q}»</h1>
        <ProductList result={result} />
      </div>
    );
  }

  return (
    <div className="container py-8">
      <h1 className="mb-6 font-display text-[34px] font-semibold tracking-tight">Каталог</h1>
      <div className="grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-4">
        {categories.map((c) => (
          <Link key={c.slug} href={`/catalog/${c.slug}`} className="card flex items-center gap-4 p-5 hover:border-signal">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[10px] bg-signal-50">
              <CategoryIcon name={c.icon} className="h-[26px] w-[26px] text-signal-800" />
            </span>
            <span className="flex flex-col gap-1">
              <span className="text-[17px] font-semibold">{c.name}</span>
              <span className="text-[13px] text-muted-foreground">{c.items}</span>
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
