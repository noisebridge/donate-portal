import { describe, expect, test } from "bun:test";
import { parseEmail } from "~/test-utils/email-dom";
import { MagicLinkEmail } from "./magic-link";

const magicLinkUrl = "https://example.com/magic-link?token=abc123";

function render() {
  return String(<MagicLinkEmail magicLinkUrl={magicLinkUrl} />);
}

describe("MagicLinkEmail", () => {
  test("should include the magic link URL in the email", () => {
    expect(render()).toContain(magicLinkUrl);
  });

  test("renders a complete email document", () => {
    const doc = parseEmail(render());

    expect(doc.title).toBe("Sign in to donate.noisebridge.net");
    expect(doc.body.textContent).toContain("Sign in to Noisebridge");
    expect(doc.body.textContent).toContain("Noisebridge Hackerspace");
  });

  test("links the sign-in button to the magic link", () => {
    const doc = parseEmail(render());
    const button = doc.querySelector("a");

    expect(button?.getAttribute("href")).toBe(magicLinkUrl);
    expect(button?.textContent?.trim()).toBe("Sign In");
  });

  test("shows the link as copyable text and warns about expiry", () => {
    const doc = parseEmail(render());

    expect(doc.body.textContent).toContain(
      "This link will expire in 5 minutes.",
    );
    const fallback = Array.from(doc.querySelectorAll("div")).find(
      (div) => div.textContent === magicLinkUrl,
    );
    expect(fallback).toBeDefined();
  });
});
