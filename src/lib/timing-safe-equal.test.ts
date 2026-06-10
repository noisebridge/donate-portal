import { describe, expect, test } from "bun:test";
import { timingSafeStringEqual } from "./timing-safe-equal";

describe("timingSafeStringEqual", () => {
  test("should return true for equal strings", () => {
    expect(timingSafeStringEqual("secret", "secret")).toBe(true);
  });

  test("should return false for different strings of equal length", () => {
    expect(timingSafeStringEqual("secret", "Secret")).toBe(false);
  });

  test("should return false for strings of different lengths", () => {
    expect(timingSafeStringEqual("secret", "secret1")).toBe(false);
  });

  test("should handle empty strings", () => {
    expect(timingSafeStringEqual("", "")).toBe(true);
    expect(timingSafeStringEqual("", "secret")).toBe(false);
  });
});
