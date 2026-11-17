import { describe, expect, test } from "bun:test";
import config from "~/config";
import paths from "~/lib/paths";
import { parseEmail } from "~/test-utils/email-dom";
import { SubscriptionWelcomeEmail } from "./subscription-welcome";

function render() {
  return String(<SubscriptionWelcomeEmail amount={{ cents: 2500 }} />);
}

describe("SubscriptionWelcomeEmail", () => {
  test("should generate email template with amount", () => {
    const result = render();

    expect(result).toInclude("$25.00");
  });

  test("renders a complete email document", () => {
    const doc = parseEmail(render());

    expect(doc.title).toBe("Thank You for Your Support!");
    expect(doc.body.textContent).toContain("Thank You for Your Support!");
    expect(doc.body.textContent).toContain("Noisebridge Hackerspace");
  });

  test("shows the monthly amount in the accent color", () => {
    const doc = parseEmail(render());
    const amount = Array.from(doc.querySelectorAll("div")).find(
      (div) => div.textContent === "$25.00",
    );

    expect(amount?.getAttribute("style")).toContain("color: #cc3333;");
  });

  test("links to the sign-in page", () => {
    const doc = parseEmail(render());
    const link = doc.querySelector("a");

    expect(link?.getAttribute("href")).toBe(
      `${config.baseUrl}${paths.signIn()}`,
    );
    expect(link?.textContent).toBe(`${config.baseUrl}${paths.signIn()}`);
  });
});
