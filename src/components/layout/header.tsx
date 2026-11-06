import Link from "next/link";
import { Search } from "lucide-react";
import { Logo } from "./logo";
import { CartLink } from "@/components/cart/cart-link";
import { getUser } from "@/lib/supabase/server";
import { isStaff } from "@/lib/staff";
import { siteConfig } from "@/config/site";

export async function Header() {
  const user = await getUser();
  const staff = user ? await isStaff() : false;
  return (
    <header className="border-b bg-white">
      <div className="container flex flex-wrap items-center gap-x-7 gap-y-3 py-3.5">
        <Logo />
        <form action="/catalog" role="search" className="flex min-w-0 flex-[1_1_300px]">
          <label htmlFor="q" className="sr-only">
            Поиск по каталогу
          </label>
          <input
            id="q"
            name="q"
            type="search"
            placeholder="Кабель ВВГ, минвата, профлист…"
            className="field rounded-r-none border-r-0"
          />
          <button type="submit" aria-label="Найти" className="flex h-11 w-[52px] items-center justify-center rounded-r-lg bg-steel-900 text-white">
            <Search className="h-[18px] w-[18px]" aria-hidden="true" />
          </button>
        </form>
        <nav aria-label="Основное меню" className="flex flex-wrap items-center gap-x-5 gap-y-1.5 text-[15px] font-medium">
          <Link href="/catalog" className="hover:text-signal-800">Каталог</Link>
          <Link href="/spec" className="hover:text-signal-800">Спецификация</Link>
          <CartLink />
          <a href={siteConfig.phoneHref} className="font-semibold">{siteConfig.phone}</a>
          {staff && <Link href="/admin" className="font-semibold text-signal-800">Админка</Link>}
          {user ? (
            <Link href="/account" className="font-semibold hover:text-signal-800">Кабинет</Link>
          ) : (
            <Link href="/login" className="btn-signal">Войти по БИН</Link>
          )}
        </nav>
      </div>
    </header>
  );
}
