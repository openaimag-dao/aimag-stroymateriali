import { describe, expect, it } from "vitest";
import { amountInWordsKzt, integerInWords } from "./amount-in-words";

describe("integerInWords", () => {
  it.each([
    [0, "ноль"],
    [1, "один"],
    [11, "одиннадцать"],
    [21, "двадцать один"],
    [100, "сто"],
    [1000, "одна тысяча"],
    [2000, "две тысячи"],
    [5000, "пять тысяч"],
    [11000, "одиннадцать тысяч"],
    [21000, "двадцать одна тысяча"],
    [112000, "сто двенадцать тысяч"],
    [1_000_000, "один миллион"],
    [2_000_002, "два миллиона два"],
    [5_234_567, "пять миллионов двести тридцать четыре тысячи пятьсот шестьдесят семь"],
    [1_000_000_000, "один миллиард"],
  ])("%i → %s", (n, words) => expect(integerInWords(n)).toBe(words));

  it("rejects fractions and negatives", () => {
    expect(() => integerInWords(1.5)).toThrow(RangeError);
    expect(() => integerInWords(-1)).toThrow(RangeError);
  });
});

describe("amountInWordsKzt", () => {
  it("formats tenge and tiyn, capitalised", () => {
    expect(amountInWordsKzt(329500)).toBe("Триста двадцать девять тысяч пятьсот тенге 00 тиын");
    expect(amountInWordsKzt(1234.5)).toBe("Одна тысяча двести тридцать четыре тенге 50 тиын");
  });
});
