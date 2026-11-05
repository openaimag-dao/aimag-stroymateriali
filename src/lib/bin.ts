/**
 * Kazakhstan БИН/ИИН: 12 digits, the last is a check digit.
 * Check = Σ d[i]·w[i] mod 11 with weights 1..11; if that gives 10, repeat with
 * weights 3..11,1,2; if it is 10 again the number is invalid.
 */
const W1 = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
const W2 = [3, 4, 5, 6, 7, 8, 9, 10, 11, 1, 2];

export function normalizeBin(raw: string): string {
  return raw.replace(/\D/g, "");
}

export function isValidBin(raw: string): boolean {
  const bin = normalizeBin(raw);
  if (!/^\d{12}$/.test(bin)) return false;
  const d = bin.split("").map(Number);
  const sum = (w: number[]) => w.reduce((s, wi, i) => s + d[i] * wi, 0) % 11;
  let check = sum(W1);
  if (check === 10) check = sum(W2);
  if (check === 10) return false;
  return check === d[11];
}
