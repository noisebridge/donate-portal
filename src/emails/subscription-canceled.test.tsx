import { describe, expect, test } from "bun:test";
import config from "~/config";
import { parseEmail } from "~/test-utils/email-dom";
import { SubscriptionCanceledEmail } from "./subscription-canceled";

function render(amount?: { cents: number }) {
  return String(<SubscriptionCanceledEmail amount={amount} />);
}

describe("SubscriptionCanceledEmail", () => {
  test("should generate email template", () => {
    const result = render({ cents: 2500 });

    expect(result).toInclude("$25.00");
  });

  test("renders a complete email document", () => {
    const doc = parseEmail(render({ cents: 2500 }));

    expect(doc.title).toBe("Your Donation Has Been Canceled");
    expect(doc.body.textContent).toContain("Your Donation Has Been Canceled");
    expect(doc.body.textContent).toContain("Noisebridge Hackerspace");
  });

  test("shows the canceled amount muted", () => {
    const doc = parseEmail(render({ cents: 2500 }));
    const amount = Array.from(doc.querySelectorAll("div")).find(
      (div) => div.textContent === "$25.00",
    );

    expect(amount?.getAttribute("style")).toContain("color: #888888;");
  });

  test("links back to the site", () => {
    const doc = parseEmail(render({ cents: 2500 }));
    const link = doc.querySelector("a");

    expect(link?.getAttribute("href")).toBe(config.baseUrl);
  });

  test("should generate email template without amount", () => {
    const result = render();

    expect(result).not.toInclude("$");
    expect(parseEmail(result).body.textContent).toContain(
      "Your monthly donation to Noisebridge has been successfully canceled.",
    );
  });
});
