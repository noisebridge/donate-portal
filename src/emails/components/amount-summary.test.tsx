import { describe, expect, test } from "bun:test";
import { parseEmailRow } from "~/test-utils/email-dom";
import { AmountSummary } from "./amount-summary";

describe("AmountSummary", () => {
  test("renders the label and formatted amount", () => {
    const doc = parseEmailRow(
      String(
        <AmountSummary
          label="Monthly Donation Amount"
          amount={{ cents: 2500 }}
          variant="accent"
        />,
      ),
    );
    const [label, amount] = Array.from(doc.querySelectorAll("div"));
    expect(label?.textContent).toBe("Monthly Donation Amount");
    expect(amount?.textContent).toBe("$25.00");
  });

  test("highlights the accent variant", () => {
    const doc = parseEmailRow(
      String(
        <AmountSummary label="L" amount={{ cents: 100 }} variant="accent" />,
      ),
    );
    const amount = Array.from(doc.querySelectorAll("div"))[1];
    expect(amount?.getAttribute("style")).toContain("color: #cc3333;");
    expect(amount?.getAttribute("style")).toContain("font-size: 36px;");
  });

  test("mutes the muted variant", () => {
    const doc = parseEmailRow(
      String(
        <AmountSummary label="L" amount={{ cents: 100 }} variant="muted" />,
      ),
    );
    const amount = Array.from(doc.querySelectorAll("div"))[1];
    expect(amount?.getAttribute("style")).toContain("color: #888888;");
  });

  test("strikes out the crossed variant in a smaller size", () => {
    const doc = parseEmailRow(
      String(
        <AmountSummary label="L" amount={{ cents: 100 }} variant="crossed" />,
      ),
    );
    const amount = Array.from(doc.querySelectorAll("div"))[1];
    expect(amount?.getAttribute("style")).toContain(
      "text-decoration: line-through;",
    );
    expect(amount?.getAttribute("style")).toContain("font-size: 24px;");
  });
});
