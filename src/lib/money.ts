/**
 * Money helpers. In this project the DB stores тенге as numeric(14,2) and all
 * prices include НДС 16%. The тиын helpers are kept for integrations that send
 * integer тиын.
 */

const KZT = new Intl.NumberFormat("ru-RU");

/** Тенге → тиын (integer). */
export function tengeToTiyn(tenge: number): number {
  return Math.round(tenge * 100);
}

/** Тиын → тенге (rounded to whole тенге). */
export function tiynToTenge(tiyn: number): number {
  return Math.round(tiyn / 100);
}

/** Format an integer тенге amount as "12 345 ₸". */
export function formatTenge(tenge: number): string {
  return `${KZT.format(tenge)} ₸`;
}

/** Format a тиын amount directly as "12 345 ₸". */
export function formatTiyn(tiyn: number): string {
  return formatTenge(tiynToTenge(tiyn));
}

/** Format a тенге amount with a per-unit suffix: "12 345 ₸/м". */
export function formatTengePerUnit(tenge: number, unit: string): string {
  return `${formatTenge(tenge)}/${unit}`;
}
