import { describe, expect, test } from "bun:test";
import {
  buildHeader,
  mergePolicies,
  type PolicyEntry,
} from "./permissions-policy";

describe("mergePolicies", () => {
  test("returns empty object for no entries", () => {
    expect(mergePolicies([])).toEqual({});
  });

  test("passes through a single policy unchanged", () => {
    const policies = [
      { camera: [], microphone: ["self"] },
    ] as const satisfies PolicyEntry[];
    expect(mergePolicies(policies)).toEqual(policies[0]);
  });

  test("merges sources from multiple entries", () => {
    const result = mergePolicies([
      { payment: ["self"] },
      { payment: ["https://js.stripe.com"] },
    ]);
    expect(result["payment"]).toContain("self");
    expect(result["payment"]).toContain("https://js.stripe.com");
    expect(result["payment"]).toHaveLength(2);
  });

  test("deduplicates identical sources", () => {
    const result = mergePolicies([
      { payment: ["self"] },
      { payment: ["self"] },
    ]);
    expect(result["payment"]).toEqual(["self"]);
  });

  test("merges different directives from different entries", () => {
    const result = mergePolicies([{ camera: [] }, { payment: ["self"] }]);
    expect(result["camera"]).toEqual([]);
    expect(result["payment"]).toEqual(["self"]);
  });
});

describe("buildHeader", () => {
  test("formats denied features as empty parens", () => {
    expect(buildHeader([{ camera: [] }])).toBe("camera=()");
  });

  test("formats self-only features", () => {
    expect(buildHeader([{ fullscreen: ["self"] }])).toBe("fullscreen=(self)");
  });

  test("formats external origins with quotes", () => {
    expect(buildHeader([{ payment: ["self", "https://js.stripe.com"] }])).toBe(
      'payment=(self "https://js.stripe.com")',
    );
  });

  test("joins multiple directives with commas", () => {
    const header = buildHeader([{ camera: [], microphone: [] }]);
    expect(header).toBe("camera=(), microphone=()");
  });
});
