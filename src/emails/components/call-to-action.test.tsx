import { describe, expect, test } from "bun:test";
import { parseEmailRow } from "~/test-utils/email-dom";
import { CallToAction } from "./call-to-action";

describe("CallToAction", () => {
  test("renders a button-styled link opening in a new tab", () => {
    const doc = parseEmailRow(
      String(<CallToAction href="https://example.com/go">Do it</CallToAction>),
    );
    const link = doc.querySelector("a");
    expect(link?.getAttribute("href")).toBe("https://example.com/go");
    expect(link?.getAttribute("target")).toBe("_blank");
    expect(link?.textContent?.trim()).toBe("Do it");
    expect(link?.getAttribute("style")).toContain("background:#cc3333;");
    expect(link?.getAttribute("style")).toContain("color:#ffffff;");
  });

  test("applies spacing to the surrounding cell", () => {
    const doc = parseEmailRow(
      String(
        <CallToAction href="https://example.com/go" top={20}>
          Do it
        </CallToAction>,
      ),
    );
    const style = doc.querySelector("td")?.getAttribute("style");
    expect(style).toContain("padding:12px 32px;");
    expect(style).toContain("padding-top:20px;");
  });
});
