import { describe, expect, test } from "bun:test";
import emailManager from "./email";

describe("EmailManager.isValidEmail", () => {
  test("accepts a standard address", () => {
    expect(emailManager.isValidEmail("user@example.com")).toBe(true);
  });

  test("accepts addresses with plus tags and subdomains", () => {
    expect(emailManager.isValidEmail("user+tag@mail.example.co.uk")).toBe(true);
  });

  test("rejects an empty string", () => {
    expect(emailManager.isValidEmail("")).toBe(false);
  });

  test("rejects addresses missing an @", () => {
    expect(emailManager.isValidEmail("user.example.com")).toBe(false);
  });

  test("rejects addresses missing a TLD", () => {
    expect(emailManager.isValidEmail("user@example")).toBe(false);
  });

  test("rejects addresses with whitespace", () => {
    expect(emailManager.isValidEmail("user @example.com")).toBe(false);
    expect(emailManager.isValidEmail("user@exa mple.com")).toBe(false);
  });

  test("rejects addresses longer than 254 characters", () => {
    const local = "a".repeat(250);
    const tooLong = `${local}@b.co`;
    expect(tooLong.length).toBeGreaterThan(254);
    expect(emailManager.isValidEmail(tooLong)).toBe(false);
  });

  test("accepts addresses at the 254 character boundary", () => {
    const local = "a".repeat(248);
    const atLimit = `${local}@b.com`;
    expect(atLimit.length).toBe(254);
    expect(emailManager.isValidEmail(atLimit)).toBe(true);
  });
});
