import { describe, expect, test } from "bun:test";
import { parseEmail } from "~/test-utils/email-dom";
import { EmailLayout } from "./layout";
import { Heading } from "./text";

function render() {
  return String(
    <EmailLayout title="Subject line">
      <Heading>Hello</Heading>
    </EmailLayout>,
  );
}

describe("EmailLayout", () => {
  test("renders a complete email document", () => {
    const result = render();

    expect(result).toStartWith("<!DOCTYPE html>");
    const doc = parseEmail(result);
    expect(doc.title).toBe("Subject line");
    expect(doc.documentElement.getAttribute("lang")).toBe("en");
    expect(doc.documentElement.getAttribute("xmlns:v")).toBe(
      "urn:schemas-microsoft-com:vml",
    );
    expect(doc.querySelector('meta[http-equiv="Content-Type"]')).not.toBeNull();
    expect(doc.querySelector('meta[name="viewport"]')).not.toBeNull();
  });

  test("labels the email for assistive technology", () => {
    const doc = parseEmail(render());
    const article = doc.querySelector('[role="article"]');
    expect(article?.getAttribute("aria-label")).toBe("Subject line");
    expect(article?.getAttribute("aria-roledescription")).toBe("email");
  });

  test("resets client styles and styles the column responsively", () => {
    const result = render();

    // The client resets every email needs.
    expect(result).toContain("body { margin:0;padding:0;");
    expect(result).toContain("mso-table-lspace:0pt;");
    // The responsive rules must target the class the column actually uses.
    expect(result).toContain(
      "@media only screen and (min-width:480px) {\n  .email-column {",
    );
    expect(result).toContain(".moz-text-html .email-column");
    expect(result).toContain('class="email-column email-outlook-group-fix"');
  });

  test("keeps the Outlook fallbacks", () => {
    const result = render();

    expect(result).toContain("<o:OfficeDocumentSettings>");
    // The 600px wrapper table and 560px column table Outlook needs.
    expect(result).toContain('style="width:600px;" width="600"');
    expect(result).toContain('style="vertical-align:top;width:560px;"');
    expect(result).toContain("<!--[if mso | IE]>");
  });

  test("wraps content in a white card on a grey body", () => {
    const doc = parseEmail(render());

    expect(doc.body.getAttribute("style")).toContain(
      "background-color:#f4f4f4;",
    );
    const card = doc.querySelector('div[style*="#ffffff"]');
    expect(card).not.toBeNull();
    // The heading lands inside the card's column table.
    expect(card?.textContent).toContain("Hello");
  });

  test("puts the footer outside the card", () => {
    const result = render();

    expect(result).toContain("Noisebridge Hackerspace");
    const doc = parseEmail(result);
    const card = doc.querySelector('div[style*="#ffffff"]');
    const footer = doc.querySelector('div[style*="#999999"]');
    expect(footer?.textContent).toBe("Noisebridge Hackerspace");
    expect(card?.contains(footer ?? doc.body)).toBe(false);
  });
});
