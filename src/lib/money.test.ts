import { describe, expect, test } from "bun:test";
import {
  type AmountFormData,
  parseToCents,
  validateAmountFormData,
} from "./money";

describe("validateAmountFormData", () => {
  test("should return false for null", () => {
    expect(validateAmountFormData(null)).toBe(false);
  });

  test("should return false for undefined", () => {
    expect(validateAmountFormData(undefined)).toBe(false);
  });

  test("should return false for arrays", () => {
    expect(validateAmountFormData([])).toBe(false);
    expect(validateAmountFormData([{ "amount-dollars": "10" }])).toBe(false);
  });

  test("should return false for non-object types", () => {
    expect(validateAmountFormData("string")).toBe(false);
    expect(validateAmountFormData(123)).toBe(false);
    expect(validateAmountFormData(true)).toBe(false);
  });

  test("should return false when amount-dollars is missing", () => {
    expect(validateAmountFormData({})).toBe(false);
    expect(validateAmountFormData({ "custom-amount": "10" })).toBe(false);
  });

  test("should return false when amount-dollars is not a string", () => {
    expect(validateAmountFormData({ "amount-dollars": 10 })).toBe(false);
    expect(validateAmountFormData({ "amount-dollars": true })).toBe(false);
    expect(validateAmountFormData({ "amount-dollars": {} })).toBe(false);
  });

  test("should return true for valid preset amount", () => {
    expect(validateAmountFormData({ "amount-dollars": "10" })).toBe(true);
    expect(validateAmountFormData({ "amount-dollars": "25" })).toBe(true);
    expect(validateAmountFormData({ "amount-dollars": "100.50" })).toBe(true);
  });

  test("should return false for invalid preset amount (NaN)", () => {
    expect(validateAmountFormData({ "amount-dollars": "abc" })).toBe(false);
    expect(validateAmountFormData({ "amount-dollars": "not-a-number" })).toBe(
      false,
    );
    expect(validateAmountFormData({ "amount-dollars": "" })).toBe(false);
  });

  test("should return false when custom amount is missing for custom type", () => {
    expect(validateAmountFormData({ "amount-dollars": "custom" })).toBe(false);
  });

  test("should return false when custom amount is not a string", () => {
    expect(
      validateAmountFormData({
        "amount-dollars": "custom",
        "custom-amount": 10,
      }),
    ).toBe(false);
    expect(
      validateAmountFormData({
        "amount-dollars": "custom",
        "custom-amount": true,
      }),
    ).toBe(false);
  });

  test("should return true for valid custom amount", () => {
    expect(
      validateAmountFormData({
        "amount-dollars": "custom",
        "custom-amount": "15",
      }),
    ).toBe(true);
    expect(
      validateAmountFormData({
        "amount-dollars": "custom",
        "custom-amount": "99.99",
      }),
    ).toBe(true);
    expect(
      validateAmountFormData({
        "amount-dollars": "custom",
        "custom-amount": "0.01",
      }),
    ).toBe(true);
  });

  test("should return false for invalid custom amount (NaN)", () => {
    expect(
      validateAmountFormData({
        "amount-dollars": "custom",
        "custom-amount": "abc",
      }),
    ).toBe(false);
    expect(
      validateAmountFormData({
        "amount-dollars": "custom",
        "custom-amount": "",
      }),
    ).toBe(false);
  });
});

describe("parseToCents", () => {
  describe("with string input", () => {
    test("should convert whole dollars to cents", () => {
      expect(parseToCents("10")).toEqual({ cents: 1000 });
      expect(parseToCents("25")).toEqual({ cents: 2500 });
      expect(parseToCents("100")).toEqual({ cents: 10000 });
    });

    test("should convert decimal dollars to cents", () => {
      expect(parseToCents("10.50")).toEqual({ cents: 1050 });
      expect(parseToCents("99.99")).toEqual({ cents: 9999 });
      expect(parseToCents("0.01")).toEqual({ cents: 1 });
      expect(parseToCents("0.99")).toEqual({ cents: 99 });
    });

    test("should round to nearest cent", () => {
      expect(parseToCents("10.505")).toEqual({ cents: 1051 });
      expect(parseToCents("10.504")).toEqual({ cents: 1050 });
      expect(parseToCents("10.999")).toEqual({ cents: 1100 });
    });

    test("should return null for invalid strings", () => {
      expect(parseToCents("abc")).toBeNull();
      expect(parseToCents("")).toBeNull();
      expect(parseToCents("not-a-number")).toBeNull();
    });

    test("should not accept negative numbers", () => {
      expect(parseToCents("-10")).toBeNull();
    });

    test("should not accept zero", () => {
      expect(parseToCents("0")).toBeNull();
    });
  });

  describe("with AmountFormData input (preset)", () => {
    test("should convert preset amounts to cents", () => {
      const formData: AmountFormData = { "amount-dollars": "10" };
      expect(parseToCents(formData)).toEqual({ cents: 1000 });
    });

    test("should handle decimal preset amounts", () => {
      const formData: AmountFormData = { "amount-dollars": "25.50" };
      expect(parseToCents(formData)).toEqual({ cents: 2550 });
    });

    test("should return null for invalid preset amounts", () => {
      // biome-ignore lint/suspicious/noExplicitAny: YOLO for tests
      const formData: any = { "amount-dollars": "invalid" };
      expect(parseToCents(formData)).toBeNull();
    });
  });

  describe("with AmountFormData input (custom)", () => {
    test("should convert custom amounts to cents", () => {
      const formData: AmountFormData = {
        "amount-dollars": "custom",
        "custom-amount": "15",
      };
      expect(parseToCents(formData)).toEqual({ cents: 1500 });
    });

    test("should return null for invalid custom amounts", () => {
      // biome-ignore lint/suspicious/noExplicitAny: YOLO for tests
      const formData: any = {
        "amount-dollars": "custom",
        "custom-amount": "invalid",
      };
      expect(parseToCents(formData)).toBeNull();
    });

    test("should round custom amounts to nearest cent", () => {
      const formData: AmountFormData = {
        "amount-dollars": "custom",
        "custom-amount": "10.505",
      };
      expect(parseToCents(formData)).toEqual({ cents: 1051 });
    });
  });

  describe("edge cases", () => {
    test("should handle very large amounts", () => {
      expect(parseToCents("999999.99")).toEqual({ cents: 99999999 });
    });

    test("should handle very small amounts", () => {
      expect(parseToCents("0.01")).toEqual({ cents: 1 });
    });

    test("should handle amounts with many decimal places", () => {
      expect(parseToCents("10.123456")).toEqual({ cents: 1012 });
    });
  });
});
