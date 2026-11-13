import Link from "next/link";
import { Check, Upload } from "lucide-react";
import { categories, siteConfig, siteUrl } from "@/config/site";
import { CategoryIcon } from "@/components/catalog/category-icon";

const steps = [
  { title: "Вход по БИН", text: "Введите БИН или ИИН — реквизиты компании заполнятся сами." },
  { title: "Корзина или заявка", text: "Соберите заказ в каталоге или загрузите свою спецификацию целиком." },
  { title: "КП и счёт с НДС", text: "Документы на ваши реквизиты в PDF — сразу для бухгалтерии и согласования." },
  { title: "Оплата и доставка", text: `Самовывоз в ${siteConfig.city}е или доставка по Казахстану за 1–3 дня.` },
];

const terms = [
  { title: "Одна цена во всех документах", text: `Цена позиции одинакова на сайте, в КП и в счёте. КП действует ${siteConfig.quoteValidDays} дней.` },
  { title: "Оптовые уровни цен", text: "Чем больше заказ, тем ниже цена. Постоянным компаниям — персональный прайс." },
  { title: "Товар под заказ", text: "Найдём позицию, которой нет в каталоге: Казахстан, Россия, Китай. Предоплата 100%." },
];

/** Разметка организации для поисковиков (schema.org). */
const orgJsonLd = {
  "@context": "https://schema.org",
  "@type": "HardwareStore",
  name: siteConfig.name,
  description: siteConfig.description,
  url: siteUrl,
  telephone: siteConfig.phone.replace(/[^+\d]/g, ""),
  email: siteConfig.email,
  address: { "@type": "PostalAddress", addressLocality: siteConfig.city, addressCountry: "KZ" },
  areaServed: { "@type": "Country", name: "Казахстан" },
  currenciesAccepted: "KZT",
};

export default function HomePage() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(orgJsonLd) }} />
      <section className="container flex flex-wrap items-stretch gap-10 py-14 md:py-16">
        <div className="flex min-w-0 flex-[999_1_560px] flex-col justify-center gap-6">
          <p className="text-sm font-semibold uppercase tracking-[0.08em] text-signal-800">
            Только для ТОО и ИП · вся Республика Казахстан
          </p>
          <h1 className="font-display text-4xl font-semibold leading-[1.08] tracking-tight md:text-[52px]">
            Стройматериалы оптом с ценой и счётом за минуты
          </h1>
          <p className="max-w-[620px] text-lg leading-relaxed text-steel-500 md:text-[19px]">
            Оптовые цены с НДС видны сразу. Соберите корзину или загрузите заявку — КП и счёт на оплату придут в PDF.
            Доставка по Казахстану за 1–3 дня.
          </p>
          <div className="flex flex-wrap gap-3">
            <Link href="/catalog" className="btn-signal h-[52px] px-6 text-base">Перейти в каталог</Link>
            <Link href="/spec" className="btn-outline h-[52px] px-6 text-base">Загрузить спецификацию</Link>
          </div>
          <ul className="mt-2 flex flex-wrap gap-x-7 gap-y-2.5 text-[15px] text-steel-700">
            {[`Цены с НДС ${siteConfig.vatPct}%`, "КП и счёт в PDF", `Ответ на заявку за ${siteConfig.specResponseMinutes} минут`].map((t) => (
              <li key={t} className="flex items-center gap-2">
                <Check className="h-[18px] w-[18px] text-emerald-700" strokeWidth={2.2} aria-hidden="true" />
                {t}
              </li>
            ))}
          </ul>
        </div>

        <div className="flex min-w-0 flex-[1_1_380px] flex-col gap-5 rounded-2xl bg-steel-900 p-8 text-white">
          <h2 className="font-display text-[22px] font-semibold leading-tight">Есть ведомость на объект? Посчитаем всё сразу</h2>
          <p className="text-[15px] leading-relaxed text-steel-200">
            Загрузите заявку в любом виде. Мы сопоставим позиции с каталогом и пришлём КП в течение{" "}
            {siteConfig.specResponseMinutes} минут в рабочее время.
          </p>
          <Link
            href="/spec"
            className="flex flex-col items-center gap-2.5 rounded-xl border-[1.5px] border-dashed border-steel-500 px-5 py-7 text-center hover:border-signal"
          >
            <Upload className="h-8 w-8" strokeWidth={1.6} aria-hidden="true" />
            <span className="font-semibold">Перетащите файл или выберите</span>
            <span className="text-[13px] text-steel-300">Excel, PDF или фото ведомости</span>
          </Link>
          <p className="text-[13px] text-steel-300">
            Или позвоните: <a href={siteConfig.phoneHref} className="font-semibold text-white">{siteConfig.phone}</a>
          </p>
        </div>
      </section>

      <section aria-labelledby="cat-h" className="container pb-16 pt-6">
        <div className="mb-6 flex flex-wrap items-baseline justify-between gap-3">
          <h2 id="cat-h" className="font-display text-3xl font-semibold tracking-tight">Категории</h2>
          <Link href="/catalog" className="text-[15px] font-semibold underline-offset-4 hover:underline">Весь каталог →</Link>
        </div>
        <div className="grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-4">
          {categories.map((c) => (
            <Link key={c.slug} href={`/catalog/${c.slug}`} className="card flex min-h-[170px] flex-col gap-3.5 p-6 hover:border-signal">
              <span className="flex h-12 w-12 items-center justify-center rounded-[10px] bg-signal-50">
                <CategoryIcon name={c.icon} className="h-[26px] w-[26px] text-signal-800" />
              </span>
              <span className="text-[19px] font-semibold">{c.name}</span>
              <span className="text-sm leading-relaxed text-muted-foreground">{c.items}</span>
            </Link>
          ))}
        </div>
      </section>

      <section aria-labelledby="how-h" className="border-y bg-white">
        <div className="container py-16">
          <h2 id="how-h" className="mb-8 font-display text-3xl font-semibold tracking-tight">Как проходит закупка</h2>
          <ol className="grid grid-cols-[repeat(auto-fit,minmax(240px,1fr))] gap-6">
            {steps.map((s, i) => (
              <li key={s.title} className={`flex flex-col gap-2.5 border-t-[3px] pt-4 ${i === 0 ? "border-signal" : "border-primary"}`}>
                <span className="font-display text-[15px] font-semibold text-signal-800">0{i + 1}</span>
                <span className="text-[19px] font-semibold">{s.title}</span>
                <span className="text-[15px] leading-relaxed text-steel-500">{s.text}</span>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section aria-labelledby="terms-h" className="container py-16">
        <h2 id="terms-h" className="mb-6 font-display text-3xl font-semibold tracking-tight">Условия для юрлиц</h2>
        <div className="grid grid-cols-[repeat(auto-fit,minmax(280px,1fr))] gap-4">
          {terms.map((t) => (
            <div key={t.title} className="card flex flex-col gap-2 p-6">
              <span className="text-lg font-semibold">{t.title}</span>
              <span className="text-[15px] leading-relaxed text-steel-500">{t.text}</span>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}
