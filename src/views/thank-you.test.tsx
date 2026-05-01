import { describe, expect, test } from "bun:test";
import { ThankYouPage } from "./thank-you";

describe("ThankYouPage", () => {
  test("should show donation complete message", async () => {
    const result = await (
      <ThankYouPage isAuthenticated={false} csrfToken={undefined} />
    );

    expect(result).toContain("Donation Complete!");
  });
});
