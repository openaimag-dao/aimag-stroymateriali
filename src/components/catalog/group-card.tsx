"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { AddToCart } from "@/components/cart/add-to-cart";
import { formatTenge } from "@/lib/money";
import { optionCompatible, pickSku, type CatalogAttr, type CatalogGroup, type Sku } from "@/lib/catalog-types";

type Props = { group: CatalogGroup; attrs: CatalogAttr[]; signedIn: boolean };

function firstSku(skus: Sku[]): Sku | undefined {
  return skus.find((s) => s.inStock) ?? skus[0];
}

export function GroupCard({ group, attrs, signedIn }: Props) {
  const [skuId, setSkuId] = useState(() => firstSku(group.skus)?.id);
  const sku = group.skus.find((s) => s.id === skuId) ?? firstSku(group.skus);

  // variant axes present in this group, with only the options its SKUs actually have
  const axes = useMemo(
    () =>
      attrs
        .filter((a) => a.isVariant && group.skus.some((s) => s.attrs[a.code]))
        .map((a) => ({ ...a, options: a.options.filter((o) => group.skus.some((s) => s.attrs[a.code] === o.value)) })),
    [attrs, group.skus],
  );

  return (
    <article className="card flex flex-col gap-4 p-5">
      <header className="flex flex-col gap-1">
        <span className="text-[13px] text-muted-foreground">{group.categoryName}</span>
        <h2 className="text-lg font-semibold leading-snug">{group.name}</h2>
        {group.description && <p className="text-sm leading-relaxed text-steel-500">{group.description}</p>}
      </header>

      {!sku ? (
        signedIn ? (
          <p className="rounded-lg bg-steel-50 p-3 text-sm text-steel-500">
            Позиции этой группы добавляются из прайсов поставщиков. Нужно сейчас?{" "}
            <Link href="/spec" className="font-semibold text-foreground underline">Загрузите спецификацию</Link>
          </p>
        ) : (
          <p className="rounded-lg bg-steel-50 p-3 text-sm text-steel-500">
            Цены, цвета и наличие — после входа.{" "}
            <Link href="/login" className="font-semibold text-foreground underline">Войти по БИН</Link>
          </p>
        )
      ) : (
        <>
          {axes.map((axis) => {
            const selected = axis.options.find((o) => o.value === sku.attrs[axis.code]);
            // not applicable to this variant (thread on a plain coupling, colour on bare zinc)
            if (!selected) return null;
            // nothing to choose: show as a plain spec line
            if (axis.options.length === 1) {
              return (
                <p key={axis.code} className="text-sm">
                  <span className="text-muted-foreground">{axis.name}: </span>
                  <span className="font-semibold">{selected.label}</span>
                </p>
              );
            }
            return (
              <fieldset key={axis.code} className="flex flex-col gap-2">
                <legend className="mb-2 text-sm">
                  <span className="text-muted-foreground">{axis.name}: </span>
                  <span className="font-semibold">{selected?.label ?? "—"}</span>
                </legend>
                <div className="flex flex-wrap gap-2">
                  {axis.options.map((o) => {
                    const active = o.value === sku.attrs[axis.code];
                    const compatible = optionCompatible(group.skus, sku.attrs, axis.code, o.value);
                    const choose = () => setSkuId(pickSku(group.skus, sku.attrs, axis.code, o.value)?.id ?? sku.id);
                    return axis.kind === "color" && o.hex ? (
                      <button
                        key={o.value}
                        type="button"
                        onClick={choose}
                        aria-pressed={active}
                        aria-label={o.label}
                        title={o.label}
                        className={`h-11 w-11 rounded-lg border-2 transition ${active ? "border-signal ring-2 ring-signal ring-offset-1" : "border-steel-200"} ${compatible ? "" : "opacity-40"}`}
                        style={{ backgroundColor: o.hex }}
                      />
                    ) : (
                      <button
                        key={o.value}
                        type="button"
                        onClick={choose}
                        aria-pressed={active}
                        className={`min-h-11 rounded-lg px-3.5 text-sm font-medium transition ${
                          active ? "bg-steel-900 text-white" : "border border-input bg-white text-foreground hover:border-steel-400"
                        } ${compatible || active ? "" : "text-muted-foreground opacity-60"}`}
                      >
                        {o.label}
                      </button>
                    );
                  })}
                </div>
              </fieldset>
            );
          })}

          <div className="flex flex-wrap items-end justify-between gap-4 border-t pt-4">
            <div className="flex flex-col gap-1">
              <span className="text-2xl font-bold tabular-nums">
                {formatTenge(sku.priceKzt)}
                <span className="text-base font-medium text-muted-foreground">/{sku.unit}</span>
              </span>
              {sku.tiers.length > 0 && (
                <span className="text-[13px] text-muted-foreground">
                  {[...sku.tiers]
                    .sort((a, b) => a.minQty - b.minQty)
                    .map((t) => `от ${t.minQty} ${sku.unit} — ${formatTenge(t.priceKzt)}`)
                    .join(" · ")}
                </span>
              )}
              {sku.inStock ? (
                <span className="badge self-start bg-emerald-50 text-emerald-800">На складе</span>
              ) : (
                <span className="badge self-start bg-amber-50 text-amber-900">
                  Под заказ{sku.leadTimeDays ? ` · ${sku.leadTimeDays} дн.` : ""}
                </span>
              )}
            </div>
            <AddToCart key={sku.id} productId={sku.id} name={sku.name} unit={sku.unit} priceKzt={sku.priceKzt} />
          </div>
        </>
      )}
    </article>
  );
}
