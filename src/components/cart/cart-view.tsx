"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { FileText, Trash2 } from "lucide-react";
import { useCart } from "./cart-provider";
import { totals } from "@/lib/pricing";
import { formatTenge } from "@/lib/money";
import { siteConfig } from "@/config/site";
import { checkout } from "@/app/cart/actions";

export type CheckoutStatus = "guest" | "no_company" | "ready";

const deliveries = [
  { id: "pickup", name: "Самовывоз", note: `${siteConfig.city}, бесплатно` },
  { id: "city", name: `По ${siteConfig.city}у`, note: "на следующий день" },
  { id: "intercity", name: "По Казахстану", note: "транспортной компанией, 1–3 дня" },
] as const;

export function CartView({ status }: { status: CheckoutStatus }) {
  const { items, setQty, remove, clear } = useCart();
  const router = useRouter();
  const [delivery, setDelivery] = useState<(typeof deliveries)[number]["id"]>("pickup");
  const [city, setCity] = useState("");
  const [address, setAddress] = useState("");
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();

  function submit(withInvoice: boolean) {
    setError("");
    startTransition(async () => {
      const res = await checkout({
        items: items.map((i) => ({ productId: i.productId, qty: i.qty })),
        delivery,
        city: delivery === "intercity" ? city : delivery === "city" ? siteConfig.city : undefined,
        address: delivery === "pickup" ? undefined : address,
        withInvoice,
      });
      if (res.error || !res.quoteId) {
        setError(res.error ?? "Не удалось сформировать документ.");
        return;
      }
      clear();
      const q = res.invoiceErrorCode ? `?invoice_error=${res.invoiceErrorCode}` : "";
      router.push(`/account/quotes/${res.quoteId}${q}`);
    });
  }

  if (items.length === 0) {
    return (
      <div className="card flex flex-col items-start gap-3 p-8">
        <p className="text-lg font-semibold">Корзина пуста</p>
        <p className="text-steel-500">Добавьте товары из каталога или загрузите спецификацию — посчитаем сами.</p>
        <div className="flex flex-wrap gap-3">
          <Link href="/catalog" className="btn-signal">В каталог</Link>
          <Link href="/spec" className="btn-outline">Загрузить спецификацию</Link>
        </div>
      </div>
    );
  }

  const t = totals(items.map((i) => ({ qty: i.qty, unitPriceKzt: i.priceKzt })));

  return (
    <div className="flex flex-wrap items-start gap-6">
      <div className="flex min-w-0 flex-[999_1_600px] flex-col gap-5">
        <section aria-label="Товары" className="card overflow-x-auto py-2">
          <table className="w-full min-w-[640px] border-collapse text-[15px]">
            <thead>
              <tr className="text-left text-[13px] text-muted-foreground">
                <th scope="col" className="px-5 py-3 font-medium">Товар</th>
                <th scope="col" className="px-3 py-3 font-medium">Кол-во</th>
                <th scope="col" className="px-3 py-3 text-right font-medium">Цена с НДС</th>
                <th scope="col" className="px-3 py-3 text-right font-medium">Сумма</th>
                <th scope="col" className="px-5 py-3"><span className="sr-only">Удалить</span></th>
              </tr>
            </thead>
            <tbody>
              {items.map((i) => (
                <tr key={i.productId} className="border-t border-steel-100">
                  <td className="px-5 py-4 font-semibold">{i.name}</td>
                  <td className="px-3 py-4">
                    <label className="flex items-center gap-2">
                      <span className="sr-only">Количество, {i.unit}</span>
                      <input
                        type="number"
                        min={1}
                        value={i.qty}
                        onChange={(e) => setQty(i.productId, Number(e.target.value) || 1)}
                        className="field w-24"
                      />
                      <span className="text-muted-foreground">{i.unit}</span>
                    </label>
                  </td>
                  <td className="px-3 py-4 text-right tabular-nums">{formatTenge(i.priceKzt)}</td>
                  <td className="px-3 py-4 text-right font-semibold tabular-nums">{formatTenge(Math.round(i.qty * i.priceKzt))}</td>
                  <td className="px-5 py-4 text-right">
                    <button type="button" onClick={() => remove(i.productId)} aria-label={`Удалить ${i.name}`} className="inline-flex h-11 w-11 items-center justify-center rounded-lg hover:bg-steel-50">
                      <Trash2 className="h-[18px] w-[18px]" aria-hidden="true" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <section aria-labelledby="del-h" className="card flex flex-col gap-3.5 p-6">
          <h2 id="del-h" className="text-[19px] font-semibold">Доставка</h2>
          <div role="radiogroup" aria-labelledby="del-h" className="grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-3">
            {deliveries.map((d) => (
              <button
                key={d.id}
                type="button"
                role="radio"
                aria-checked={delivery === d.id}
                onClick={() => setDelivery(d.id)}
                className={`flex min-h-[72px] flex-col gap-1 rounded-[10px] px-4 py-3.5 text-left ${delivery === d.id ? "border-2 border-signal bg-signal-50" : "border border-input bg-white"}`}
              >
                <span className="font-semibold">{d.name}</span>
                <span className="text-[13px] text-muted-foreground">{d.note}</span>
              </button>
            ))}
          </div>
          {delivery !== "pickup" && (
            <div className="flex flex-wrap gap-3">
              {delivery === "intercity" && (
                <label className="flex flex-[1_1_200px] flex-col gap-1.5 text-[13px] text-muted-foreground">
                  Город доставки
                  <input value={city} onChange={(e) => setCity(e.target.value)} maxLength={120} className="field" placeholder="Туркестан" />
                </label>
              )}
              <label className="flex flex-[2_1_320px] flex-col gap-1.5 text-[13px] text-muted-foreground">
                Адрес объекта
                <input value={address} onChange={(e) => setAddress(e.target.value)} maxLength={300} className="field" placeholder="Улица, дом, ориентир" />
              </label>
              <p className="w-full text-sm text-steel-500">Стоимость доставки менеджер рассчитает по весу заказа и адресу и выставит отдельно.</p>
            </div>
          )}
        </section>
      </div>

      <aside aria-labelledby="sum-h" className="card flex min-w-0 flex-[1_1_340px] flex-col gap-4 p-6">
        <h2 id="sum-h" className="text-[19px] font-semibold">Итого</h2>
        <dl className="flex flex-col gap-2.5 text-[15px] tabular-nums">
          <Row label="Товары без НДС" value={formatTenge(t.netKzt)} />
          <Row label={`НДС ${siteConfig.vatPct}%`} value={formatTenge(t.vatKzt)} />
          <Row label="Доставка" value={delivery === "pickup" ? formatTenge(0) : "отдельно"} />
          <div className="flex justify-between gap-3 border-t pt-3 text-xl font-bold">
            <dt>К оплате с НДС</dt>
            <dd>{formatTenge(t.totalKzt)}</dd>
          </div>
        </dl>
        {status === "ready" && (
          <>
            <button type="button" disabled={pending} onClick={() => submit(true)} className="btn-signal h-[52px] text-base">
              {pending ? "Формируем документы…" : "Выставить счёт на оплату"}
            </button>
            <button type="button" disabled={pending} onClick={() => submit(false)} className="btn-outline h-[52px] text-base">
              <FileText className="h-[18px] w-[18px]" aria-hidden="true" /> Получить КП в PDF
            </button>
          </>
        )}
        {status === "guest" && (
          <>
            <Link href="/login?next=/cart" className="btn-signal h-[52px] text-base">Войти и выставить счёт</Link>
            <p className="text-[13px] text-muted-foreground">Счёт и КП оформляются на реквизиты вашей компании — нужен вход по email и БИН.</p>
          </>
        )}
        {status === "no_company" && (
          <Link href="/account" className="btn-signal h-[52px] text-base">Указать данные компании</Link>
        )}
        {error && (
          <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-800">{error}</p>
        )}
        <p className="text-[13px] leading-relaxed text-muted-foreground">
          КП действует {siteConfig.quoteValidDays} дней. Оптовая цена по объёму применяется при выставлении. Товар под заказ — по 100%
          предоплате. Вопросы: <a href={siteConfig.phoneHref} className="font-semibold text-foreground">{siteConfig.phone}</a>
        </p>
      </aside>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-steel-500">{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}
