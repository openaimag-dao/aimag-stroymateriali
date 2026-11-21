import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getProductPage } from "@/lib/product";
import { formatTenge } from "@/lib/money";
import { siteConfig, siteUrl } from "@/config/site";
import { AddToCart } from "@/components/cart/add-to-cart";
import { waLink } from "@/lib/whatsapp";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const p = await getProductPage((await params).id);
  if (!p) return { title: "Товар не найден", robots: { index: false } };
  const title = `${p.name} — цена ${formatTenge(p.priceKzt)} за ${p.unit}`;
  const description = `${p.name}${p.spec ? `, ${p.spec}` : ""}. Цена с НДС ${formatTenge(p.priceKzt)} за ${p.unit} в ${siteConfig.city}е, оптовые скидки от объёма, КП и счёт для ТОО и ИП, доставка по Казахстану.`;
  return { title, description, alternates: { canonical: `/product/${p.id}` }, openGraph: { title, description, type: "website" } };
}

export default async function ProductPage({ params }: Props) {
  const p = await getProductPage((await params).id);
  if (!p) notFound();

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: p.name,
    description: p.spec ?? p.name,
    category: p.categoryName,
    offers: {
      "@type": "Offer",
      url: `${siteUrl}/product/${p.id}`,
      priceCurrency: "KZT",
      price: p.priceKzt,
      availability: p.inStock ? "https://schema.org/InStock" : "https://schema.org/PreOrder",
      seller: { "@type": "Organization", name: siteConfig.name },
    },
  };

  return (
    <div className="container flex flex-col gap-6 py-8">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <nav aria-label="Хлебные крошки" className="text-sm text-muted-foreground">
        <Link href="/">Главная</Link> / <Link href="/catalog">Каталог</Link> /{" "}
        {p.parentSlug && (
          <>
            <Link href={`/catalog/${p.parentSlug}`}>{p.parentName}</Link> /{" "}
          </>
        )}
        <Link href={`/catalog/${p.categorySlug}`}>{p.categoryName}</Link>
      </nav>

      <div className="flex flex-wrap items-start gap-6">
        <section className="flex min-w-0 flex-[999_1_520px] flex-col gap-4">
          {p.groupName && <span className="text-[13px] text-muted-foreground">{p.groupName}</span>}
          <h1 className="font-display text-[30px] font-semibold leading-tight tracking-tight">{p.name}</h1>
          {p.spec && <p className="text-[17px] text-steel-500">{p.spec}</p>}
          {p.attrs.length > 0 && (
            <dl className="card grid grid-cols-[minmax(120px,auto)_1fr] gap-x-6 gap-y-2 p-5 text-[15px]">
              {p.attrs.map((a) => (
                <div key={a.name} className="contents">
                  <dt className="text-muted-foreground">{a.name}</dt>
                  <dd className="font-medium">{a.value}</dd>
                </div>
              ))}
              <dt className="text-muted-foreground">Единица</dt>
              <dd className="font-medium">{p.unit}</dd>
            </dl>
          )}
        </section>

        <aside className="card flex min-w-0 flex-[1_1_320px] flex-col gap-4 p-6">
          <div className="flex flex-col gap-1">
            <span className="text-3xl font-bold tabular-nums">
              {formatTenge(p.priceKzt)}
              <span className="text-base font-medium text-muted-foreground">/{p.unit}</span>
            </span>
            <span className="text-[13px] text-muted-foreground">с НДС {siteConfig.vatPct}%</span>
          </div>
          {p.tiers.length > 0 && (
            <ul className="flex flex-col gap-1 rounded-lg bg-steel-50 p-3 text-sm tabular-nums">
              {p.tiers.map((t) => (
                <li key={t.minQty}>
                  от {t.minQty} {p.unit} — <b>{formatTenge(t.priceKzt)}</b>
                </li>
              ))}
            </ul>
          )}
          {p.inStock ? (
            <span className="badge self-start bg-emerald-50 text-emerald-800">На складе</span>
          ) : (
            <span className="badge self-start bg-amber-50 text-amber-900">Под заказ{p.leadTimeDays ? ` · ${p.leadTimeDays} дн.` : ""}</span>
          )}
          <AddToCart productId={p.id} name={p.name} unit={p.unit} priceKzt={p.priceKzt} />
          <a
            href={waLink(`Здравствуйте! Интересует: ${p.name} (${formatTenge(p.priceKzt)}/${p.unit}). ${siteUrl}/product/${p.id}`)}
            target="_blank"
            rel="noopener"
            className="btn-outline"
          >
            Спросить в WhatsApp
          </a>
          <p className="text-[13px] leading-relaxed text-muted-foreground">
            КП и счёт на вашу компанию — после входа по БИН. Персональная скидка и оптовая цена применяются в КП автоматически.
          </p>
        </aside>
      </div>
    </div>
  );
}
