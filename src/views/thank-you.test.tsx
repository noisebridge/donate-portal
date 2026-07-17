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

  test("should not claim processing payments have tickets yet", async () => {
    const result = await (
      <ThankYouPage
        isTicket
        ticketStatus="processing"
        email="buyer@example.com"
        isAuthenticated={false}
        csrfToken={undefined}
      />
    );

    expect(result).toContain("Payment processing.");
    expect(result).toContain("as soon as it succeeds");
    expect(result).not.toContain("You&#39;re in.");
  });

  test("should let incomplete ticket payments retry", async () => {
    const result = await (
      <ThankYouPage
        isTicket
        ticketStatus="incomplete"
        email="buyer@example.com"
        isAuthenticated={false}
        csrfToken={undefined}
      />
    );

    expect(result).toContain("No tickets issued.");
    expect(result).toContain('href="/afterparty"');
    expect(result).toContain("Try payment again");
  });
});
