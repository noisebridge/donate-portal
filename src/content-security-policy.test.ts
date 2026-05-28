import { describe, expect, test } from "bun:test";
import {
  buildHeader,
  mergePolicies,
  type PolicyEntry,
} from "./content-security-policy";

describe("mergePolicies", () => {
  test("returns empty object for no entries", () => {
    expect(mergePolicies([])).toEqual({});
  });

  test("passes through a single policy unchanged", () => {
    const policies = [
      { "script-src": ["'self'"], "img-src": ["'self'"] },
    ] as const satisfies PolicyEntry[];
    const result = mergePolicies(policies);
    expect(result).toEqual(policies[0]);
  });

  test("merges sources from multiple entries", () => {
    const result = mergePolicies([
      { "script-src": ["'self'"] },
      { "script-src": ["https://cdn.example.com"] },
    ]);
    expect(result["script-src"]).toContain("'self'");
    expect(result["script-src"]).toContain("https://cdn.example.com");
    expect(result["script-src"]).toHaveLength(2);
  });

  test("deduplicates identical sources", () => {
    const result = mergePolicies([
      { "style-src": ["'self'", "'unsafe-hashes'"] },
      { "style-src": ["'self'"] },
    ]);
    expect(result["style-src"]).toHaveLength(2);
    expect(result["style-src"]).toContain("'self'");
    expect(result["style-src"]).toContain("'unsafe-hashes'");
  });

  test("merges different directives from different entries", () => {
    const result = mergePolicies([
      { "script-src": ["'self'"] },
      { "img-src": ["https://images.example.com"] },
    ]);
    expect(result["script-src"]).toEqual(["'self'"]);
    expect(result["img-src"]).toEqual(["https://images.example.com"]);
  });

  test("removes 'none' when other sources exist for the same directive", () => {
    const result = mergePolicies([
      { "frame-src": ["'none'"] },
      { "frame-src": ["https://js.stripe.com"] },
    ]);
    expect(result["frame-src"]).toEqual(["https://js.stripe.com"]);
  });

  test("keeps 'none' when it is the only source", () => {
    const result = mergePolicies([{ "frame-src": ["'none'"] }]);
    expect(result["frame-src"]).toEqual(["'none'"]);
  });

  test("keeps 'none' when duplicated but still the only value", () => {
    const result = mergePolicies([
      { "frame-src": ["'none'"] },
      { "frame-src": ["'none'"] },
    ]);
    expect(result["frame-src"]).toEqual(["'none'"]);
  });
});

describe("buildHeader", () => {
  test("formats a single directive with one source", () => {
    expect(buildHeader([{ "script-src": ["'self'"] }])).toBe(
      "script-src 'self'",
    );
  });

  test("joins multiple sources with spaces", () => {
    expect(
      buildHeader([{ "script-src": ["'self'", "https://cdn.example.com"] }]),
    ).toBe("script-src 'self' https://cdn.example.com");
  });

  test("joins multiple directives with semicolons", () => {
    const header = buildHeader([
      { "script-src": ["'self'"], "img-src": ["'self'"] },
    ]);
    expect(header).toBe("script-src 'self'; img-src 'self'");
  });

  test("merges entries before formatting", () => {
    const header = buildHeader([
      { "script-src": ["'self'"] },
      { "script-src": ["https://cdn.example.com"] },
    ]);
    expect(header).toBe("script-src 'self' https://cdn.example.com");
  });
});
