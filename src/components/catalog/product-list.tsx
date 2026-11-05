import Link from "next/link";
import type { CatalogResult } from "@/lib/catalog";
import { formatTenge } from "@/lib/money";
import { AddToCart } from "@/components/cart/add-to-cart";

export function ProductList({ result }: { result: CatalogResult }) {
  if (result.status === "not_configured") {
    return <Notice title="База ещё не подключена">Добавьте ключи Supabase в переменные окружения — товары появятся здесь.</Notice>;
  }
  if (result.status === "login_required") {
    return (
      <Notice title="Оптовые цены — после входа">
        Цены и наличие видны зарегистрированным компаниям.{" "}
        <Link href="/login" className="font-semibold underline">Войти по БИН</Link>
      </Notice>
    );
  }
  if (result.status === "error") {
    return <Notice title="Не удалось загрузить каталог">{result.message}</Notice>;
  }
  if (result.products.length === 0) {
    return (
      <Notice title="Здесь пока пусто">
        Позиции добавляются из прайсов поставщиков. Нужна позиция сейчас?{" "}
        <Link href="/spec" className="font-semibold underline">Загрузите спецификацию</Link>
      </Notice>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-muted-foreground">Цены с НДС 16%. Оптовая цена применяется автоматически от указанного объёма.</p>
      {result.products.map((p) => {
        const tier = [...p.price_tiers].sort((a, b) => a.min_qty - b.min_qty)[0];
        return (
          <article key={p.id} className="card flex flex-wrap items-center gap-x-6 gap-y-4 px-5 py-4">
            <div className="flex min-w-0 flex-[1_1_280px] flex-col gap-1.5">
              <h2 className="text-[17px] font-semibold leading-snug">{p.name}</h2>
              <span className="text-[13px] text-muted-foreground">
                {p.spec ? `${p.spec} · ` : ""}за {p.unit}
              </span>
              {p.in_stock ? (
                <span className="badge self-start bg-emerald-50 text-emerald-800">На складе</span>
              ) : (
                <span className="badge self-start bg-amber-50 text-amber-900">
                  Под заказ{p.lead_time_days ? ` · ${p.lead_time_days} дн.` : ""}
                </span>
              )}
            </div>
            <div className="flex flex-[0_1_200px] flex-col gap-1">
              <span className="text-xl font-bold tabular-nums">{formatTenge(p.price_kzt)}</span>
              {tier && (
                <span className="text-[13px] text-muted-foreground">
                  опт от {tier.min_qty} {p.unit}: <b className="text-foreground">{formatTenge(tier.price_kzt)}</b>
                </span>
              )}
            </div>
            <AddToCart productId={p.id} name={p.name} unit={p.unit} priceKzt={p.price_kzt} />
          </article>
        );
      })}
    </div>
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
