import { describe, expect, test } from "bun:test";
import { parseCondition } from "./condition";

describe("parseCondition", () => {
  test("parses a bare feature", () => {
    expect(parseCondition("mso")).toStrictEqual({
      kind: "test",
      feature: "mso",
    });
  });

  test("parses a comparison and version", () => {
    expect(parseCondition("lte mso 11")).toStrictEqual({
      kind: "test",
      operator: "lte",
      feature: "mso",
      version: 11,
    });
  });

  test("parses a feature with only a version", () => {
    expect(parseCondition("IE 8")).toStrictEqual({
      kind: "test",
      feature: "IE",
      version: 8,
    });
    expect(parseCondition("mso 0")).toStrictEqual({
      kind: "test",
      feature: "mso",
      version: 0,
    });
  });

  test("accepts operators without surrounding spaces", () => {
    expect(parseCondition("mso&IE")).toStrictEqual({
      kind: "and",
      left: { kind: "test", feature: "mso" },
      right: { kind: "test", feature: "IE" },
    });
  });

  test("parses nested negation", () => {
    expect(parseCondition("!!mso")).toStrictEqual({
      kind: "not",
      operand: { kind: "not", operand: { kind: "test", feature: "mso" } },
    });
  });

  test("normalizes the operator case", () => {
    expect(parseCondition("LTE mso 11")).toStrictEqual({
      kind: "test",
      operator: "lte",
      feature: "mso",
      version: 11,
    });
  });

  test("parses negation", () => {
    expect(parseCondition("!mso")).toStrictEqual({
      kind: "not",
      operand: { kind: "test", feature: "mso" },
    });
  });

  test("parses a negated group", () => {
    expect(parseCondition("!(mso | IE)")).toStrictEqual({
      kind: "not",
      operand: {
        kind: "or",
        left: { kind: "test", feature: "mso" },
        right: { kind: "test", feature: "IE" },
      },
    });
  });

  test("parses AND and OR", () => {
    expect(parseCondition("(gte mso 9)&(lt mso 12)")).toStrictEqual({
      kind: "and",
      left: { kind: "test", operator: "gte", feature: "mso", version: 9 },
      right: { kind: "test", operator: "lt", feature: "mso", version: 12 },
    });
    expect(parseCondition("mso | IE")).toStrictEqual({
      kind: "or",
      left: { kind: "test", feature: "mso" },
      right: { kind: "test", feature: "IE" },
    });
  });

  test("binds & tighter than |", () => {
    expect(parseCondition("mso | IE & mso 9")).toStrictEqual({
      kind: "or",
      left: { kind: "test", feature: "mso" },
      right: {
        kind: "and",
        left: { kind: "test", feature: "IE" },
        right: { kind: "test", feature: "mso", version: 9 },
      },
    });
  });

  test("lets parentheses override precedence", () => {
    expect(parseCondition("(mso | IE) & mso 9")).toStrictEqual({
      kind: "and",
      left: {
        kind: "or",
        left: { kind: "test", feature: "mso" },
        right: { kind: "test", feature: "IE" },
      },
      right: { kind: "test", feature: "mso", version: 9 },
    });
  });

  test("ignores surrounding whitespace", () => {
    expect(parseCondition("  ( gte mso 9 ) & ( lt mso 12 )  ")).toStrictEqual(
      parseCondition("(gte mso 9)&(lt mso 12)"),
    );
  });

  const invalid = [
    "",
    "   ",
    "mso]",
    "mso]><script>",
    "mso &",
    "| mso",
    "mso | | IE",
    "(mso",
    "mso)",
    "mso IE",
    "mso 11 12",
    "gte",
    "!",
    "()",
  ];

  for (const source of invalid) {
    test(`rejects ${JSON.stringify(source)}`, () => {
      expect(() => parseCondition(source)).toThrow(TypeError);
    });
  }
});
