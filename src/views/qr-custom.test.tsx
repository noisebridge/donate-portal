import { describe, expect, test } from "bun:test";
import { QrCustomPage } from "./qr-custom";

describe("QrCustomPage", () => {
  test("should include a donate button", async () => {
    const result = await (
      <QrCustomPage amount={{ cents: 1000 }} isAuthenticated={false} />
    );

    expect(result).toContain("Donate");
  });

  test("should pre-fill the amount input", async () => {
    const result = await (
      <QrCustomPage amount={{ cents: 2500 }} isAuthenticated={false} />
    );

    expect(result).toContain('value="25.00"');
  });

  test("should pre-fill name when provided", async () => {
    const result = await (
      <QrCustomPage
        amount={{ cents: 1000 }}
        name="Coffee"
        isAuthenticated={false}
      />
    );

    expect(result).toContain('value="Coffee"');
  });

  test("should pre-fill description when provided", async () => {
    const result = await (
      <QrCustomPage
        amount={{ cents: 1000 }}
        description="Support NoiseCafe"
        isAuthenticated={false}
      />
    );

    expect(result).toContain('value="Support NoiseCafe"');
  });

  test("should include a back link to the qr page", async () => {
    const result = await (
      <QrCustomPage
        amount={{ cents: 500 }}
        name="Tea"
        isAuthenticated={false}
      />
    );

    expect(result).toContain("/qr?amount=5&name=Tea");
  });
});
