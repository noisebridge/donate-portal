import { beforeEach, describe, expect, test } from "bun:test";
import { send as sendEmail } from "~/test-utils/resend.mock";
import * as emailManager from "./email";

describe("email", () => {
  beforeEach(() => {
    sendEmail.mockClear();
  });

  test("accepts a standard address", () => {
    expect(emailManager.isValid("user@example.com")).toBe(true);
  });

  test("accepts addresses with plus tags and subdomains", () => {
    expect(emailManager.isValid("user+tag@mail.example.co.uk")).toBe(true);
  });

  test("rejects an empty string", () => {
    expect(emailManager.isValid("")).toBe(false);
  });

  test("rejects addresses missing an @", () => {
    expect(emailManager.isValid("user.example.com")).toBe(false);
  });

  test("rejects addresses missing a TLD", () => {
    expect(emailManager.isValid("user@example")).toBe(false);
  });

  test("rejects addresses with whitespace", () => {
    expect(emailManager.isValid("user @example.com")).toBe(false);
    expect(emailManager.isValid("user@exa mple.com")).toBe(false);
  });

  test("rejects addresses longer than 254 characters", () => {
    const local = "a".repeat(250);
    const tooLong = `${local}@b.co`;
    expect(tooLong.length).toBeGreaterThan(254);
    expect(emailManager.isValid(tooLong)).toBe(false);
  });

  test("accepts addresses at the 254 character boundary", () => {
    const local = "a".repeat(248);
    const atLimit = `${local}@b.com`;
    expect(atLimit.length).toBe(254);
    expect(emailManager.isValid(atLimit)).toBe(true);
  });

  describe("sendMagicLink", () => {
    test("sends a magic link email containing the sign-in URL", async () => {
      const result = await emailManager.sendMagicLink("user@example.com");

      expect(result).toEqual({ success: true, id: "email_mock" });
      const [params] = sendEmail.mock.calls[0] as unknown as [
        { to: string; subject: string; html: string },
      ];
      expect(params.to).toBe("user@example.com");
      expect(params.html).toContain("/auth/email/callback?state=");
    });

    test("reports the provider error when sending fails", async () => {
      sendEmail.mockResolvedValueOnce({
        data: null,
        error: { message: "Email service down", name: "internal_server_error" },
        headers: null,
      } as unknown as Awaited<ReturnType<typeof sendEmail>>);

      expect(await emailManager.sendMagicLink("user@example.com")).toEqual({
        success: false,
        error: "Email service down",
      });
    });
  });
});
