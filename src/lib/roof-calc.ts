/**
 * Калькулятор кровли: размеры дома → площадь скатов → позиции каталога с количеством.
 * Чистая логика без сети и React — проверяется тестами. Нормы — типовые для металлочерепицы
 * и профнастила; точный раскрой листов делает менеджер в КП.
 */

export type RoofType = "gable" | "shed";
export type Covering = "metal-tile" | "profnastil";

export type RoofInput = {
  type: RoofType;
  /** длина дома вдоль конька (вдоль карниза у односкатной), м */
  length: number;
  /** ширина дома поперёк конька, м */
  width: number;
  /** угол наклона ската, градусы */
  pitch: number;
  /** свес кровли с каждой стороны, м */
  overhang: number;
  covering: Covering;
  withGutters: boolean;
  withMembrane: boolean;
};

export type CalcProduct = {
  id: string;
  name: string;
  unit: string;
  priceKzt: number;
  categorySlug: string;
  attrs: Record<string, string>;
};

export type CalcLine = {
  key: "covering" | "ridge" | "membrane" | "screws" | "gutters";
  title: string;
  /** как посчитано — показываем покупателю */
  basis: string;
  qty: number;
  product: CalcProduct | null;
};

export type RoofResult = {
  slopeLength: number;
  eaveLength: number;
  area: number;
  lines: CalcLine[];
  warnings: string[];
};

/** Запас на подрезку и нахлёсты листов. */
export const WASTE: Record<Covering, number> = { "metal-tile": 0.15, profnastil: 0.1 };
/** Минимальный уклон по рекомендациям производителей. */
export const MIN_PITCH: Record<Covering, number> = { "metal-tile": 14, profnastil: 8 };
export const SCREWS_PER_M2 = 8;
export const SCREWS_PER_PACK = 250;
export const MEMBRANE_ROLL_M2 = 70;
export const MEMBRANE_OVERLAP = 0.15;
export const RIDGE_OVERLAP = 0.1;
export const GUTTER_LENGTH_M = 3;

export const LIMITS = {
  length: [1, 200],
  width: [1, 100],
  pitch: [5, 60],
  overhang: [0, 1.5],
} as const;

const round2 = (n: number) => Math.round(n * 100) / 100;
const fmt = (n: number) => round2(n).toLocaleString("ru-RU");

export function validate(input: RoofInput): string | null {
  for (const key of ["length", "width", "pitch", "overhang"] as const) {
    const v = input[key];
    const [min, max] = LIMITS[key];
    if (!Number.isFinite(v) || v < min || v > max) {
      const names = { length: "Длина", width: "Ширина", pitch: "Угол", overhang: "Свес" };
      return `${names[key]}: от ${min} до ${max}`;
    }
  }
  return null;
}

export function calcRoof(input: RoofInput, products: CalcProduct[], color: string | null): RoofResult {
  const slopes = input.type === "gable" ? 2 : 1;
  const run = input.type === "gable" ? input.width / 2 + input.overhang : input.width + 2 * input.overhang;
  const slopeLength = run / Math.cos((input.pitch * Math.PI) / 180);
  const eaveLength = input.length + 2 * input.overhang;
  const area = slopes * slopeLength * eaveLength;

  const pick = (categorySlug: string) => pickProduct(products, categorySlug, color);
  const lines: CalcLine[] = [];
  const waste = WASTE[input.covering];

  lines.push({
    key: "covering",
    title: input.covering === "metal-tile" ? "Металлочерепица" : "Профнастил",
    basis: `${fmt(area)} м² скатов + ${Math.round(waste * 100)}% на подрезку и нахлёсты`,
    qty: Math.ceil(area * (1 + waste)),
    product: pick(input.covering),
  });

  if (input.type === "gable") {
    lines.push({
      key: "ridge",
      title: "Конёк",
      basis: `${fmt(eaveLength)} м по коньку + ${Math.round(RIDGE_OVERLAP * 100)}% на нахлёст`,
      qty: Math.ceil(eaveLength * (1 + RIDGE_OVERLAP)),
      product: pick("roof-extras"),
    });
  }

  if (input.withMembrane) {
    lines.push({
      key: "membrane",
      title: "Гидро-ветрозащитная мембрана",
      basis: `${fmt(area)} м² + ${Math.round(MEMBRANE_OVERLAP * 100)}% нахлёст, рулон ${MEMBRANE_ROLL_M2} м²`,
      qty: Math.ceil((area * (1 + MEMBRANE_OVERLAP)) / MEMBRANE_ROLL_M2),
      product: pick("roof-membranes"),
    });
  }

  lines.push({
    key: "screws",
    title: "Саморезы кровельные",
    basis: `${SCREWS_PER_M2} шт/м² × ${fmt(area)} м², упаковка ${SCREWS_PER_PACK} шт`,
    qty: Math.ceil((area * SCREWS_PER_M2) / SCREWS_PER_PACK),
    product: pick("roof-fasteners"),
  });

  if (input.withGutters) {
    lines.push({
      key: "gutters",
      title: "Желоб водосточный",
      basis: `${slopes} × ${fmt(eaveLength)} м карниза, желоб ${GUTTER_LENGTH_M} м`,
      qty: slopes * Math.ceil(eaveLength / GUTTER_LENGTH_M),
      product: pick("gutters"),
    });
  }

  const warnings: string[] = [];
  const minPitch = MIN_PITCH[input.covering];
  if (input.pitch < minPitch) {
    warnings.push(
      `Для покрытия «${lines[0].title.toLowerCase()}» уклон должен быть не меньше ${minPitch}°, иначе возможны протечки.`,
    );
  }
  for (const l of lines) {
    if (l.product && color && l.product.attrs.ral && l.product.attrs.ral !== color) {
      warnings.push(`${l.title}: цвета ${ralLabel(color)} нет в каталоге, подобран ${ralLabel(l.product.attrs.ral)}.`);
    }
  }

  return { slopeLength: round2(slopeLength), eaveLength: round2(eaveLength), area: round2(area), lines, warnings };
}

/** Товар нужного раздела: сначала точное совпадение цвета, затем окрашенный, затем любой. */
export function pickProduct(products: CalcProduct[], categorySlug: string, color: string | null): CalcProduct | null {
  const inCat = products.filter((p) => p.categorySlug === categorySlug);
  if (!inCat.length) return null;
  const sorted = [...inCat].sort((a, b) => a.priceKzt - b.priceKzt);
  return (
    (color && sorted.find((p) => p.attrs.ral === color)) ||
    sorted.find((p) => p.attrs.ral) ||
    sorted[0]
  );
}

/** Цвета, доступные для выбранного покрытия. */
export function coveringColors(products: CalcProduct[], covering: Covering): string[] {
  return [...new Set(products.filter((p) => p.categorySlug === covering && p.attrs.ral).map((p) => p.attrs.ral))].sort();
}

export function ralLabel(ral: string): string {
  return ral.replace(/^RAL\s?/i, "RAL ");
}

export function lineTotal(line: CalcLine): number {
  return line.product ? line.qty * line.product.priceKzt : 0;
}
