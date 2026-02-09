import { describe, expect, test } from "bun:test";
import { formatAmount } from "~/money";
import { QrPage } from "./qr";

describe("QrPage", () => {
  test("should render qr page", async () => {
    const result = await (
      <QrPage amount={{ cents: 1000 }} isAuthenticated={false} />
    );

    expect(result).toBeTypeOf("string");
    expect(result.length).toBeGreaterThan(0);
  });

  test("should display the formatted amount", async () => {
    const amount = { cents: 2500 };
    const result = await (<QrPage amount={amount} isAuthenticated={false} />);

    expect(result).toContain(formatAmount(amount));
  });

  test("should include a donate button", async () => {
    const result = await (
      <QrPage amount={{ cents: 1000 }} isAuthenticated={false} />
    );

    expect(result).toContain("Donate");
  });

  test("should render name when provided", async () => {
    const result = await (
      <QrPage
        amount={{ cents: 1000 }}
        name="Test Event"
        isAuthenticated={false}
      />
    );

    expect(result).toContain("Test Event");
  });

  test("should render description when provided", async () => {
    const result = await (
      <QrPage
        amount={{ cents: 1000 }}
        description="A test donation"
        isAuthenticated={false}
      />
    );

    expect(result).toContain("A test donation");
  });
});
