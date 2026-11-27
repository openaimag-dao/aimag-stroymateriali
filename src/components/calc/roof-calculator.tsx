"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Check } from "lucide-react";
import { useCart } from "@/components/cart/cart-provider";
import { formatTenge } from "@/lib/money";
import {
  calcRoof,
  coveringColors,
  lineTotal,
  ralLabel,
  validate,
  type CalcProduct,
  type Covering,
  type RoofInput,
  type RoofType,
} from "@/lib/roof-calc";

const RAL_HEX: Record<string, string> = {
  RAL3005: "#5E2129",
  RAL6005: "#2F4538",
  RAL8017: "#45322E",
  RAL9003: "#F4F4F4",
};

function NumberField(props: { label: string; unit: string; value: string; onChange: (v: string) => void; step?: string; hint?: string }) {
  return (
    <label className="flex flex-col gap-1.5 text-sm font-medium">
      {props.label}
      <span className="flex items-center gap-2">
        <input
          type="number"
          inputMode="decimal"
          step={props.step ?? "0.1"}
          value={props.value}
          onChange={(e) => props.onChange(e.target.value)}
          className="field w-full"
        />
        <span className="w-6 text-steel-500">{props.unit}</span>
      </span>
      {props.hint && <span className="text-xs font-normal text-steel-500">{props.hint}</span>}
    </label>
  );
}

function Choice<T extends string>(props: { legend: string; value: T; options: { value: T; label: string }[]; onChange: (v: T) => void }) {
  return (
    <fieldset className="flex flex-col gap-1.5 text-sm font-medium">
      <legend className="mb-1.5">{props.legend}</legend>
      <div className="flex flex-wrap gap-2">
        {props.options.map((o) => (
          <button
            key={o.value}
            type="button"
            aria-pressed={props.value === o.value}
            onClick={() => props.onChange(o.value)}
            className={`rounded-lg border px-3.5 py-2 text-sm ${
              props.value === o.value ? "border-signal bg-signal/10 font-semibold" : "border-steel-200 hover:border-steel-400"
            }`}
          >
            {o.label}
          </button>
        ))}
      </div>
    </fieldset>
  );
}

export function RoofCalculator({ products }: { products: CalcProduct[] }) {
  const { add } = useCart();
  const [type, setType] = useState<RoofType>("gable");
  const [covering, setCovering] = useState<Covering>("metal-tile");
  const [length, setLength] = useState("10");
  const [width, setWidth] = useState("8");
  const [pitch, setPitch] = useState("30");
  const [overhang, setOverhang] = useState("0.5");
  const [withGutters, setWithGutters] = useState(true);
  const [withMembrane, setWithMembrane] = useState(true);
  const [color, setColor] = useState<string | null>(null);
  const [added, setAdded] = useState(false);

  const colors = useMemo(() => coveringColors(products, covering), [products, covering]);
  const activeColor = color && colors.includes(color) ? color : (colors[0] ?? null);

  const input: RoofInput = {
    type,
    covering,
    length: Number(length.replace(",", ".")),
    width: Number(width.replace(",", ".")),
    pitch: Number(pitch.replace(",", ".")),
    overhang: Number(overhang.replace(",", ".")),
    withGutters,
    withMembrane,
  };
  const error = validate(input);
  const result = error ? null : calcRoof(input, products, activeColor);
  const total = result ? result.lines.reduce((s, l) => s + lineTotal(l), 0) : 0;
  const buyable = result?.lines.filter((l) => l.product && l.qty > 0) ?? [];

  function addAll() {
    for (const l of buyable) {
      const p = l.product!;
      add({ productId: p.id, name: p.name, unit: p.unit, priceKzt: p.priceKzt, qty: l.qty });
    }
    setAdded(true);
    setTimeout(() => setAdded(false), 2500);
  }

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-[minmax(0,400px)_minmax(0,1fr)]">
      <div className="card flex flex-col gap-5 p-6">
        <Choice
          legend="Тип крыши"
          value={type}
          onChange={setType}
          options={[
            { value: "gable", label: "Двускатная" },
            { value: "shed", label: "Односкатная" },
          ]}
        />
        <Choice
          legend="Покрытие"
          value={covering}
          onChange={setCovering}
          options={[
            { value: "metal-tile", label: "Металлочерепица" },
            { value: "profnastil", label: "Профнастил" },
          ]}
        />
        <div className="grid grid-cols-2 gap-3.5">
          <NumberField label="Длина дома" unit="м" value={length} onChange={setLength} hint={type === "gable" ? "вдоль конька" : "вдоль карниза"} />
          <NumberField label="Ширина дома" unit="м" value={width} onChange={setWidth} hint={type === "gable" ? "поперёк конька" : "от карниза до карниза"} />
          <NumberField label="Уклон" unit="°" value={pitch} onChange={setPitch} step="1" hint="обычно 25–45°" />
          <NumberField label="Свес" unit="м" value={overhang} onChange={setOverhang} hint="с каждой стороны" />
        </div>
        {colors.length > 0 && (
          <fieldset className="flex flex-col gap-1.5 text-sm font-medium">
            <legend className="mb-1.5">Цвет</legend>
            <div className="flex flex-wrap gap-2">
              {colors.map((c) => (
                <button
                  key={c}
                  type="button"
                  aria-pressed={activeColor === c}
                  onClick={() => setColor(c)}
                  className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm ${
                    activeColor === c ? "border-signal bg-signal/10 font-semibold" : "border-steel-200 hover:border-steel-400"
                  }`}
                >
                  <span className="h-4 w-4 rounded-full border border-steel-300" style={{ background: RAL_HEX[c] ?? "#999" }} aria-hidden="true" />
                  {ralLabel(c)}
                </button>
              ))}
            </div>
          </fieldset>
        )}
        <div className="flex flex-col gap-2 text-sm">
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={withMembrane} onChange={(e) => setWithMembrane(e.target.checked)} />
            Гидро-ветрозащитная мембрана
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={withGutters} onChange={(e) => setWithGutters(e.target.checked)} />
            Водосточный желоб
          </label>
        </div>
      </div>

      <div className="card flex flex-col gap-4 p-6" aria-live="polite">
        {error || !result ? (
          <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-800">
            Проверьте размеры. {error}
          </p>
        ) : (
          <>
            <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm text-steel-500">
              <span>
                Площадь скатов: <b className="text-foreground">{result.area.toLocaleString("ru-RU")} м²</b>
              </span>
              <span>Длина ската: {result.slopeLength.toLocaleString("ru-RU")} м</span>
              <span>Карниз: {result.eaveLength.toLocaleString("ru-RU")} м</span>
            </div>
            <ul className="flex flex-col divide-y divide-steel-100 border-y border-steel-200">
              {result.lines.map((l) => (
                <li key={l.key} className="flex flex-col gap-1.5 py-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
                  <div className="min-w-0">
                    {l.product ? (
                      <Link href={`/product/${l.product.id}`} className="font-medium hover:text-signal-800">
                        {l.product.name}
                      </Link>
                    ) : (
                      <span className="font-medium">{l.title} — уточнит менеджер</span>
                    )}
                    <div className="text-xs text-steel-500">{l.basis}</div>
                  </div>
                  <div className="flex shrink-0 items-baseline justify-between gap-3 text-sm sm:justify-end">
                    <span className="whitespace-nowrap text-steel-500">
                      {l.qty} {l.product?.unit ?? ""}
                      {l.product && <> × {formatTenge(l.product.priceKzt)}</>}
                    </span>
                    <span className="w-28 whitespace-nowrap text-right font-semibold">{l.product ? formatTenge(lineTotal(l)) : "—"}</span>
                  </div>
                </li>
              ))}
            </ul>
            {result.warnings.length > 0 && (
              <ul className="flex flex-col gap-1 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
                {result.warnings.map((w) => (
                  <li key={w}>{w}</li>
                ))}
              </ul>
            )}
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="text-sm text-steel-500">Итого с НДС, ориентировочно</div>
                <div className="font-display text-[28px] font-semibold">{formatTenge(total)}</div>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                {added && (
                  <Link href="/cart" className="text-sm font-medium text-signal-800 underline-offset-4 hover:underline">
                    Перейти в корзину
                  </Link>
                )}
                <button type="button" className="btn-signal h-12 whitespace-nowrap" disabled={!buyable.length} onClick={addAll}>
                  {added ? (
                    <>
                      <Check className="h-4 w-4" aria-hidden="true" /> Добавлено
                    </>
                  ) : (
                    "Добавить всё в корзину"
                  )}
                </button>
              </div>
            </div>
            <p className="text-xs text-steel-500">
              Расчёт по типовым нормам: запас на подрезку {covering === "metal-tile" ? "15" : "10"}%, 8 саморезов на м². Ендовы,
              примыкания, планки и кронштейны водостока считает менеджер по чертежу, оптовая цена — в КП.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
