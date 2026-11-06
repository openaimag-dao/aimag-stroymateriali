/** Сумма прописью для КП и счетов: «Триста двадцать девять тысяч пятьсот тенге 00 тиын». */

const ONES_M = ["", "один", "два", "три", "четыре", "пять", "шесть", "семь", "восемь", "девять"];
const ONES_F = ["", "одна", "две", "три", "четыре", "пять", "шесть", "семь", "восемь", "девять"];
const TEENS = ["десять", "одиннадцать", "двенадцать", "тринадцать", "четырнадцать", "пятнадцать", "шестнадцать", "семнадцать", "восемнадцать", "девятнадцать"];
const TENS = ["", "", "двадцать", "тридцать", "сорок", "пятьдесят", "шестьдесят", "семьдесят", "восемьдесят", "девяносто"];
const HUNDREDS = ["", "сто", "двести", "триста", "четыреста", "пятьсот", "шестьсот", "семьсот", "восемьсот", "девятьсот"];

// [one, few, many, feminine]
const SCALES: [string, string, string, boolean][] = [
  ["", "", "", false],
  ["тысяча", "тысячи", "тысяч", true],
  ["миллион", "миллиона", "миллионов", false],
  ["миллиард", "миллиарда", "миллиардов", false],
];

function plural(n: number, one: string, few: string, many: string): string {
  const n100 = n % 100;
  const n10 = n % 10;
  if (n100 >= 11 && n100 <= 14) return many;
  if (n10 === 1) return one;
  if (n10 >= 2 && n10 <= 4) return few;
  return many;
}

function triad(n: number, feminine: boolean): string[] {
  const words: string[] = [];
  const h = Math.floor(n / 100);
  const rest = n % 100;
  if (h) words.push(HUNDREDS[h]);
  if (rest >= 10 && rest < 20) {
    words.push(TEENS[rest - 10]);
  } else {
    const t = Math.floor(rest / 10);
    const o = rest % 10;
    if (t) words.push(TENS[t]);
    if (o) words.push((feminine ? ONES_F : ONES_M)[o]);
  }
  return words;
}

export function integerInWords(value: number): string {
  if (!Number.isInteger(value) || value < 0 || value >= 1e12) {
    throw new RangeError("integerInWords: expected an integer from 0 to 999 999 999 999");
  }
  if (value === 0) return "ноль";
  const words: string[] = [];
  let n = value;
  const groups: number[] = [];
  while (n > 0) {
    groups.push(n % 1000);
    n = Math.floor(n / 1000);
  }
  for (let i = groups.length - 1; i >= 0; i--) {
    const g = groups[i];
    if (!g) continue;
    const [one, few, many, fem] = SCALES[i];
    words.push(...triad(g, fem));
    if (i > 0) words.push(plural(g, one, few, many));
  }
  return words.join(" ");
}

export function amountInWordsKzt(amount: number): string {
  const rounded = Math.round(amount * 100);
  const tenge = Math.floor(rounded / 100);
  const tiyn = rounded % 100;
  const text = `${integerInWords(tenge)} тенге ${String(tiyn).padStart(2, "0")} тиын`;
  return text.charAt(0).toUpperCase() + text.slice(1);
}
