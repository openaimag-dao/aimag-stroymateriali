import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getCategoryPage } from "@/lib/catalog";
import { parseFilters } from "@/lib/catalog-types";
import { ProductList } from "@/components/catalog/product-list";
import { GroupCard } from "@/components/catalog/group-card";
import { CatalogFilters } from "@/components/catalog/catalog-filters";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const page = await getCategoryPage(slug, {});
  return { title: page ? `${page.category.name} оптом` : "Каталог" };
}

export default async function CategoryPage({ params, searchParams }: Props) {
  const { slug } = await params;
  const filters = parseFilters(await searchParams);
  const page = await getCategoryPage(slug, filters);
  if (!page) notFound();

  const { category, parent, children, siblings, attrs, groups, loose, signedIn } = page;
  const action = `/catalog/${category.slug}`;
  const hasFilters = Object.keys(filters).length > 0;

  return (
    <div className="container py-7">
      <nav aria-label="Хлебные крошки" className="mb-3 text-sm text-muted-foreground">
        <Link href="/">Главная</Link> / <Link href="/catalog">Каталог</Link>
        {parent && (
          <>
            {" "}/ <Link href={`/catalog/${parent.slug}`}>{parent.name}</Link>
          </>
        )}{" "}
        / {category.name}
      </nav>
      <h1 className="mb-4 font-display text-[34px] font-semibold tracking-tight">{category.name}</h1>

      {(children.length > 0 || parent) && (
        <nav aria-label={`Разделы: ${(parent ?? category).name}`} className="mb-6 flex flex-wrap gap-2">
          <SubLink href={`/catalog/${(parent ?? category).slug}`} active={!parent}>Все</SubLink>
          {(parent ? siblings : children).map((c) => (
            <SubLink key={c.slug} href={`/catalog/${c.slug}`} active={c.slug === category.slug}>
              {c.name}
            </SubLink>
          ))}
        </nav>
      )}

      {page.status === "not_configured" && (
        <Notice title="База ещё не подключена">Подразделы, фильтры и товары появятся после подключения Supabase.</Notice>
      )}
      {page.status === "error" && <Notice title="Не удалось загрузить раздел">{page.error}</Notice>}

      {page.status === "ok" && (
        <div className="flex flex-wrap items-start gap-6">
          {attrs.some((a) => a.isFilter) && (
            <aside className="max-w-full flex-[1_1_260px]">
              <CatalogFilters action={action} attrs={attrs} filters={filters} />
            </aside>
          )}
          <section aria-label="Товары" className="flex min-w-0 flex-[999_1_640px] flex-col gap-4">
            {!signedIn && (
              <p className="rounded-lg bg-signal-50 p-4 text-[15px]">
                Оптовые цены, цвета и наличие видны после входа.{" "}
                <Link href={`/login?next=${encodeURIComponent(action)}`} className="font-semibold underline">Войти по БИН</Link>
              </p>
            )}
            {groups.length === 0 && loose.length === 0 ? (
              <Notice title={hasFilters ? "Ничего не найдено" : "Раздел наполняется"}>
                {hasFilters ? (
                  <>Попробуйте убрать часть фильтров или <Link href="/spec" className="font-semibold underline">пришлите спецификацию</Link> — найдём под заказ.</>
                ) : (
                  <>Позиции добавляются из прайсов поставщиков. Нужна позиция сейчас? <Link href="/spec" className="font-semibold underline">Загрузите спецификацию</Link></>
                )}
              </Notice>
            ) : (
              <>
                <div className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,420px),1fr))] gap-4">
                  {groups.map((g) => (
                    <GroupCard key={g.id} group={g} attrs={attrs} signedIn={signedIn} />
                  ))}
                </div>
                {loose.length > 0 && <ProductList result={{ status: "ok", products: loose }} />}
              </>
            )}
          </section>
        </div>
      )}
    </div>
  );
}

function SubLink({ href, active, children }: { href: string; active: boolean; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={`inline-flex min-h-11 items-center rounded-full px-4 text-[15px] font-medium ${
        active ? "bg-steel-900 text-white" : "border border-input bg-white hover:border-steel-400"
      }`}
    >
      {children}
    </Link>
  );
}

function Notice({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="card flex flex-col gap-2 p-6">
      <h2 className="text-lg font-semibold">{title}</h2>
      <p className="text-[15px] text-steel-500">{children}</p>
    </div>
  );
}
