import { describe, expect, test } from "bun:test";
import config from "~/config";
import paths from "~/lib/paths";
import { parseEmail } from "~/test-utils/email-dom";
import { SubscriptionUpdatedEmail } from "./subscription-updated";

function render() {
  return String(
    <SubscriptionUpdatedEmail
      oldAmount={{ cents: 1000 }}
      newAmount={{ cents: 2500 }}
    />,
  );
}

describe("SubscriptionUpdatedEmail", () => {
  test("should generate email template with old and new amounts", () => {
    const result = render();

    expect(result).toInclude("$10.00");
    expect(result).toInclude("$25.00");
  });

  test("renders a complete email document", () => {
    const doc = parseEmail(render());

    expect(doc.title).toBe("Your Donation Has Been Updated");
    expect(doc.body.textContent).toContain("Your Donation Has Been Updated");
    expect(doc.body.textContent).toContain("Noisebridge Hackerspace");
  });

  test("strikes out the previous amount and highlights the new one", () => {
    const doc = parseEmail(render());
    const find = (text: string) =>
      Array.from(doc.querySelectorAll("div")).find(
        (div) => div.textContent === text,
      );

    expect(find("$10.00")?.getAttribute("style")).toContain(
      "text-decoration: line-through;",
    );
    expect(find("$25.00")?.getAttribute("style")).toContain("color: #cc3333;");
  });

  test("links to the sign-in page", () => {
    const doc = parseEmail(render());
    const link = doc.querySelector("a");

    expect(link?.getAttribute("href")).toBe(
      `${config.baseUrl}${paths.signIn()}`,
    );
  });
});
