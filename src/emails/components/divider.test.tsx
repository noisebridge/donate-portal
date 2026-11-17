import { describe, expect, test } from "bun:test";
import { parseEmailRow } from "~/test-utils/email-dom";
import { Divider } from "./divider";

describe("Divider", () => {
  test("renders a horizontal rule with room around it", () => {
    const doc = parseEmailRow(String(<Divider />));
    const rule = doc.querySelector("p");
    expect(rule?.getAttribute("style")).toContain(
      "border-top:solid 4px #e0e0e0;",
    );
    expect(doc.querySelector("td")?.getAttribute("style")).toContain(
      "padding:30px 0 20px 0;",
    );
  });

  test("keeps the Outlook fallback rule", () => {
    const result = String(<Divider />);
    expect(result).toContain("<!--[if mso | IE]>");
    expect(result).toContain("border-top:solid 4px #e0e0e0;");
  });
});
