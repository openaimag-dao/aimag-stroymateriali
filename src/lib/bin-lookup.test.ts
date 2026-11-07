import { describe, expect, it } from "vitest";
import { parseStatGovResponse, splitLegalForm } from "./bin-lookup";

describe("splitLegalForm", () => {
  it("strips short forms and quotes", () => {
    expect(splitLegalForm('ТОО "Ромашка-Строй"')).toEqual({ legalForm: "ТОО", name: "Ромашка-Строй" });
    expect(splitLegalForm("АО «Казахтелеком»")).toEqual({ legalForm: "АО", name: "Казахтелеком" });
  });

  it("strips spelled-out forms in any case", () => {
    expect(splitLegalForm('Товарищество с ограниченной ответственностью "AIMAG Group"')).toEqual({
      legalForm: "ТОО",
      name: "AIMAG Group",
    });
    expect(splitLegalForm("АКЦИОНЕРНОЕ ОБЩЕСТВО  «БАНК»")).toEqual({ legalForm: "АО", name: "БАНК" });
  });

  it("does not cut a name that merely starts with the same letters", () => {
    expect(splitLegalForm("Аозёрный")).toEqual({ legalForm: "Другое", name: "Аозёрный" });
    expect(splitLegalForm("Ипподром")).toEqual({ legalForm: "Другое", name: "Ипподром" });
  });

  it("uses the registry IP flag when the name has no form", () => {
    expect(splitLegalForm("ИВАНОВ ИВАН ИВАНОВИЧ", true)).toEqual({ legalForm: "ИП", name: "ИВАНОВ ИВАН ИВАНОВИЧ" });
    expect(splitLegalForm('ИП "Сауле"')).toEqual({ legalForm: "ИП", name: "Сауле" });
  });
});

describe("parseStatGovResponse", () => {
  const bin = "000740001307";

  it("maps registry fields", () => {
    const info = parseStatGovResponse(
      {
        success: true,
        obj: {
          bin,
          name: 'ТОО "Ромашка"',
          registerDate: "2000-07-17T00:00:00.000+00:00",
          okedCode: "46731",
          katoAddress: "г.Шымкент,  Аль-Фарабийский район, ул. Тауке хана, 1",
          fio: "ИВАНОВ ИВАН",
          ip: false,
        },
      },
      bin,
    );
    expect(info).toEqual({
      bin,
      name: "Ромашка",
      legalForm: "ТОО",
      director: "ИВАНОВ ИВАН",
      address: "г.Шымкент, Аль-Фарабийский район, ул. Тауке хана, 1",
      oked: "46731",
      registeredAt: "2000-07-17",
    });
  });

  it("returns null when not found or for another BIN", () => {
    expect(parseStatGovResponse({ success: false, obj: null }, bin)).toBeNull();
    expect(parseStatGovResponse({ success: true, obj: { bin: "111111111111", name: "X" } }, bin)).toBeNull();
    expect(parseStatGovResponse("oops", bin)).toBeNull();
    expect(parseStatGovResponse({ success: true, obj: { bin } }, bin)).toBeNull();
  });
});
