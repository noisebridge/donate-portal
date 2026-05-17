import { describe, expect, test } from "bun:test";
import emailService from "./email";

describe("EmailService.isValidEmail", () => {
  test("accepts a standard address", () => {
    expect(emailService.isValidEmail("user@example.com")).toBe(true);
  });

  test("accepts addresses with plus tags and subdomains", () => {
    expect(emailService.isValidEmail("user+tag@mail.example.co.uk")).toBe(true);
  });

  test("rejects an empty string", () => {
    expect(emailService.isValidEmail("")).toBe(false);
  });

  test("rejects addresses missing an @", () => {
    expect(emailService.isValidEmail("user.example.com")).toBe(false);
  });

  test("rejects addresses missing a TLD", () => {
    expect(emailService.isValidEmail("user@example")).toBe(false);
  });

  test("rejects addresses with whitespace", () => {
    expect(emailService.isValidEmail("user @example.com")).toBe(false);
    expect(emailService.isValidEmail("user@exa mple.com")).toBe(false);
  });

  test("rejects addresses longer than 254 characters", () => {
    const local = "a".repeat(250);
    const tooLong = `${local}@b.co`;
    expect(tooLong.length).toBeGreaterThan(254);
    expect(emailService.isValidEmail(tooLong)).toBe(false);
  });

  test("accepts addresses at the 254 character boundary", () => {
    const local = "a".repeat(248);
    const atLimit = `${local}@b.com`;
    expect(atLimit.length).toBe(254);
    expect(emailService.isValidEmail(atLimit)).toBe(true);
  });
});
