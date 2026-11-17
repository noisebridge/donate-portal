import { describe, expect, test } from "bun:test";
import config from "~/config";
import paths from "~/lib/paths";
import { parseEmail } from "~/test-utils/email-dom";
import { SubscriptionPastDueEmail } from "./subscription-past-due";

function render(amount?: { cents: number }) {
  return String(<SubscriptionPastDueEmail amount={amount} />);
}

describe("SubscriptionPastDueEmail", () => {
  test("should generate email template with amount", () => {
    const result = render({ cents: 1000 });

    expect(result).toInclude("$10.00");
  });

  test("should generate email template without amount", () => {
    const result = render();

    expect(result).not.toInclude("$");
  });

  test("renders a complete email document", () => {
    const doc = parseEmail(render({ cents: 1000 }));

    expect(doc.title).toBe("Payment Issue with Your Donation");
    expect(doc.body.textContent).toContain("Payment Issue with Your Donation");
    expect(doc.body.textContent).toContain("Noisebridge Hackerspace");
  });

  test("links the sign-in button to the sign-in page", () => {
    const doc = parseEmail(render({ cents: 1000 }));
    const button = doc.querySelector("a");

    expect(button?.getAttribute("href")).toBe(
      `${config.baseUrl}${paths.signIn()}`,
    );
    expect(button?.textContent?.trim()).toBe("Sign In");
  });

  test("tells the donor where to update payment details", () => {
    const doc = parseEmail(render({ cents: 1000 }));

    expect(doc.body.textContent).toContain(
      'Once signed in, click "Past invoices & payment method".',
    );
  });
});
