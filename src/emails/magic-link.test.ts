import { describe, expect, test } from "bun:test";
import { MagicLinkEmail } from "./magic-link";

describe("MagicLinkEmail", () => {
  test("should include the magic link URL in the email", () => {
    const url = "https://example.com/magic-link?token=abc123";
    const result = MagicLinkEmail({ magicLinkUrl: url });

    expect(result).toContain(url);
  });
});
