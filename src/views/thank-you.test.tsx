import { describe, expect, test } from "bun:test";
import { ThankYouPage } from "./thank-you";

describe("ThankYouPage", () => {
  test("should show thank you message", async () => {
    const result = await (
      <ThankYouPage isAuthenticated={false} csrfToken={undefined} />
    );

    expect(result).toContain("you keep us running.");
  });
});
