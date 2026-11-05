import Link from "next/link";
import { Logo } from "./logo";
import { siteConfig } from "@/config/site";

export function Footer() {
  return (
    <footer className="bg-steel-900 text-steel-200">
      <div className="container flex flex-wrap justify-between gap-8 py-12">
        <div className="flex max-w-sm flex-col gap-3">
          <Logo dark />
          <p className="text-sm leading-relaxed">
            Оптовые стройматериалы для ТОО и ИП. {siteConfig.city}, доставка по Казахстану.
          </p>
        </div>
        <div className="flex flex-col gap-2">
          <a href={siteConfig.phoneHref} className="text-lg font-semibold text-white">{siteConfig.phone}</a>
          <a href={`mailto:${siteConfig.email}`} className="text-white underline">{siteConfig.email}</a>
        </div>
        <nav aria-label="Нижнее меню" className="flex flex-col gap-2 text-[15px] text-white">
          <Link href="/catalog">Каталог</Link>
          <Link href="/spec">Загрузить спецификацию</Link>
          <Link href="/account">Кабинет компании</Link>
        </nav>
      </div>
    </footer>
  );
}
