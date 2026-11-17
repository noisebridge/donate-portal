import { describe, expect, test } from "bun:test";
import { parseEmailRow } from "~/test-utils/email-dom";
import { FallbackLink, FinePrint, Heading, Note, Paragraph } from "./text";

describe("Heading", () => {
  test("renders bold headline text with room below", () => {
    const doc = parseEmailRow(String(<Heading>Big news</Heading>));
    const div = doc.querySelector("div");
    expect(div?.textContent).toBe("Big news");
    expect(div?.getAttribute("style")).toContain("font-size:24px;");
    expect(div?.getAttribute("style")).toContain("font-weight:700;");
    expect(doc.querySelector("td")?.getAttribute("style")).toContain(
      "padding-bottom:20px;",
    );
  });
});

describe("Paragraph", () => {
  test("renders body copy with the default text style", () => {
    const doc = parseEmailRow(String(<Paragraph>Hello there.</Paragraph>));
    const div = doc.querySelector("div");
    expect(div?.textContent).toBe("Hello there.");
    expect(div?.getAttribute("style")).toContain("font-size:14px;");
    expect(div?.getAttribute("style")).toContain("color:#555555;");
  });

  test("passes inline links through untouched", () => {
    const doc = parseEmailRow(
      String(
        <Paragraph>
          Visit <a href="https://noisebridge.net">the wiki</a> today.
        </Paragraph>,
      ),
    );
    const link = doc.querySelector("a");
    expect(link?.getAttribute("href")).toBe("https://noisebridge.net");
    expect(link?.textContent).toBe("the wiki");
    expect(doc.querySelector("div")?.textContent).toBe("Visit the wiki today.");
  });

  test("applies spacing to the surrounding cell", () => {
    const doc = parseEmailRow(
      String(
        <Paragraph top={30} bottom={5}>
          Spaced.
        </Paragraph>,
      ),
    );
    const style = doc.querySelector("td")?.getAttribute("style");
    expect(style).toContain("padding-top:30px;");
    expect(style).toContain("padding-bottom:5px;");
  });
});

describe("Note", () => {
  test("renders small muted text", () => {
    const doc = parseEmailRow(String(<Note>A footnote-ish remark.</Note>));
    const div = doc.querySelector("div");
    expect(div?.getAttribute("style")).toContain("font-size:13px;");
    expect(div?.getAttribute("style")).toContain("color:#888888;");
  });
});

describe("FinePrint", () => {
  test("renders the smallest muted text", () => {
    const doc = parseEmailRow(String(<FinePrint>Legal-ish.</FinePrint>));
    const div = doc.querySelector("div");
    expect(div?.getAttribute("style")).toContain("font-size:12px;");
    expect(div?.getAttribute("style")).toContain("color:#888888;");
  });
});

describe("FallbackLink", () => {
  test("shows the URL as copyable text, not a link", () => {
    const doc = parseEmailRow(
      String(<FallbackLink href="https://example.com/x" />),
    );
    expect(doc.querySelector("a")).toBeNull();
    const div = doc.querySelector("div");
    expect(div?.textContent).toBe("https://example.com/x");
    expect(div?.getAttribute("style")).toContain("font-size:11px;");
    expect(div?.getAttribute("style")).toContain("color:#0066cc;");
  });
});
