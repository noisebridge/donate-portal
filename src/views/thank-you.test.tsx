import { describe, expect, test } from "bun:test";
import { ThankYouPage } from "./thank-you";

describe("ThankYouPage", () => {
  test("should show thank you message for donations", async () => {
    const result = await (
      <ThankYouPage isAuthenticated={false} csrfToken={undefined} />
    );

    expect(result).toContain("you keep us running.");
  });

  test("should show the buyer's email for ticket purchases", async () => {
    const result = await (
      <ThankYouPage
        isTicket
        email="buyer@example.com"
        isAuthenticated={false}
        csrfToken={undefined}
      />
    );

    expect(result).toContain("buyer@example.com");
    expect(result).toContain("on their way");
  });

  test("should fall back to generic ticket copy without an email", async () => {
    const result = await (
      <ThankYouPage isTicket isAuthenticated={false} csrfToken={undefined} />
    );

    expect(result).toContain("on their way to your email");
  });
});
