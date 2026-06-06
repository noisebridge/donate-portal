import { describe, expect, test } from "bun:test";
import { QrPage } from "./qr";

describe("QrPage", () => {
  test("should display the donation amount", async () => {
    const result = await (
      <QrPage
        amount={{ cents: 2500 }}
        isAuthenticated={false}
        csrfToken={undefined}
      />
    );

    expect(result).toContain("Donate · $25");
    expect(result).toContain('value="25.00"');
  });

  test("should include a donate button", async () => {
    const result = await (
      <QrPage
        amount={{ cents: 1000 }}
        isAuthenticated={false}
        csrfToken={undefined}
      />
    );

    expect(result).toContain("Donate");
  });

  test("should render name when provided", async () => {
    const result = await (
      <QrPage
        amount={{ cents: 1000 }}
        name="Test Event"
        isAuthenticated={false}
        csrfToken={undefined}
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
        csrfToken={undefined}
      />
    );

    expect(result).toContain("A test donation");
  });

  test("should show general donation link for non-general products", async () => {
    const result = await (
      <QrPage
        amount={{ cents: 1000 }}
        name="Workshop Fee"
        isAuthenticated={false}
        csrfToken={undefined}
      />
    );

    expect(result).toContain("Make a general donation");
  });

  test("should hide general donation link for general donation products", async () => {
    const result = await (
      <QrPage
        amount={{ cents: 1000 }}
        name="Donation to Noisebridge"
        isAuthenticated={false}
        csrfToken={undefined}
      />
    );

    expect(result).not.toContain("Make a general donation");
  });

  test("should hide general donation link when no name is provided", async () => {
    const result = await (
      <QrPage
        amount={{ cents: 1000 }}
        isAuthenticated={false}
        csrfToken={undefined}
      />
    );

    expect(result).not.toContain("Make a general donation");
  });
});
