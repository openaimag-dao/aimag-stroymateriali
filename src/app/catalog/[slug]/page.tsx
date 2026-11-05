import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { categories } from "@/config/site";
import { listProducts } from "@/lib/catalog";
import { ProductList } from "@/components/catalog/product-list";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params;
  const cat = categories.find((c) => c.slug === slug);
  return { title: cat ? `${cat.name} оптом` : "Каталог" };
}

export default async function CategoryPage({ params }: Params) {
  const { slug } = await params;
  const cat = categories.find((c) => c.slug === slug);
  if (!cat) notFound();
  const result = await listProducts({ categorySlug: slug });

  return (
    <div className="container py-7">
      <nav aria-label="Хлебные крошки" className="mb-3 text-sm text-muted-foreground">
        <Link href="/">Главная</Link> / <Link href="/catalog">Каталог</Link> / {cat.name}
      </nav>
      <h1 className="mb-6 font-display text-[34px] font-semibold tracking-tight">{cat.name}</h1>
      <div className="flex flex-wrap items-start gap-6">
        <aside aria-label="Другие категории" className="card flex max-w-full flex-[1_1_240px] flex-col gap-1 p-3 text-[15px]">
          {categories.map((c) => (
            <Link
              key={c.slug}
              href={`/catalog/${c.slug}`}
              aria-current={c.slug === slug ? "page" : undefined}
              className={`flex min-h-11 items-center rounded-lg px-3 ${c.slug === slug ? "bg-signal-50 font-semibold text-signal-800" : "hover:bg-steel-50"}`}
            >
              {c.name}
            </Link>
          ))}
          <Link href="/spec" className="mt-2 flex flex-col gap-1 rounded-[10px] bg-signal-50 p-4">
            <span className="font-semibold">Не нашли позицию?</span>
            <span className="text-sm text-steel-500">Загрузите спецификацию — найдём под заказ.</span>
          </Link>
        </aside>
        <section aria-label="Товары" className="min-w-0 flex-[999_1_640px]">
          <ProductList result={result} />
        </section>
      </div>
    </div>
  );
}
