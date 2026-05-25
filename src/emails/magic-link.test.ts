import { describe, expect, test } from "bun:test";
import { MagicLinkEmail } from "./magic-link";

describe("MagicLinkEmail", () => {
  test("should include the magic link URL in the email", async () => {
    const url = "https://example.com/magic-link?token=abc123";
    const result = await MagicLinkEmail({ magicLinkUrl: url });

    expect(result).toContain(url);
  });
});
