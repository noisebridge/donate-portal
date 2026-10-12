import { describe, expect, test } from "bun:test";
import { createMockSubscription } from "~/test-utils/mock-subscription";
import { ManagePage } from "./manage";

describe("ManagePage", () => {
  test("should render with email", () => {
    const result = String(
      <ManagePage email="test@example.com" csrfToken={undefined} />,
    );

    expect(result).toContain("test@example.com");
  });

  test("should display error message when provided", () => {
    const errorMessage = "Failed to update subscription";
    const result = String(
      <ManagePage
        email="test@example.com"
        messages={[{ type: "error", text: errorMessage }]}
        csrfToken={undefined}
      />,
    );

    expect(result).toContain(errorMessage);
    expect(result).toContain('class="message message-error"');
  });

  test("should display info message when provided", () => {
    const infoMessage = "Your donation amount has been updated.";
    const result = String(
      <ManagePage
        email="test@example.com"
        messages={[{ type: "info", text: infoMessage }]}
        csrfToken={undefined}
      />,
    );

    expect(result).toContain(infoMessage);
    expect(result).toContain('class="message message-info"');
  });

  test("should not display message when no messages provided", () => {
    const result = String(
      <ManagePage email="test@example.com" csrfToken={undefined} />,
    );

    expect(result).not.toContain('class="message ');
  });

  test("should display cancel form when subscription exists", () => {
    const result = String(
      <ManagePage
        email="test@example.com"
        subscription={createMockSubscription()}
        csrfToken={undefined}
      />,
    );

    expect(result).toContain("Cancel subscription");
  });

  test("status strip shows amount and renewal date", () => {
    const result = String(
      <ManagePage
        email="test@example.com"
        subscription={createMockSubscription({ unitAmount: 10000 })}
        csrfToken={undefined}
      />,
    );

    expect(result).toContain('class="status-strip offset-frame"');
    expect(result).toContain("$100.00");
    expect(result).toContain("Jan");
    expect(result).toContain("2025");
    expect(result).toContain("pill-ok");
    expect(result).toContain("active");
  });

  test("status strip shows a non-standard amount", () => {
    const result = String(
      <ManagePage
        email="test@example.com"
        subscription={createMockSubscription({ unitAmount: 7500 })}
        csrfToken={undefined}
      />,
    );

    expect(result).toContain("$75.00");
  });

  test("shows no-subscription notice when no subscription", () => {
    const result = String(
      <ManagePage email="test@example.com" csrfToken={undefined} />,
    );

    expect(result).toContain('class="status-null"');
    expect(result).not.toContain('class="status-strip"');
  });

  test("should display portal form when subscription exists", () => {
    const result = String(
      <ManagePage
        email="test@example.com"
        subscription={createMockSubscription()}
        csrfToken={undefined}
      />,
    );

    expect(result).toContain('action="/subscribe/portal"');
    expect(result).toContain("Past invoices");
  });

  test("should not display portal form without subscription", () => {
    const result = String(
      <ManagePage email="test@example.com" csrfToken={undefined} />,
    );

    expect(result).not.toContain('action="/subscribe/portal"');
  });

  test("shows pill-warn for past_due status", () => {
    const sub = createMockSubscription();
    sub.status = "past_due";
    const result = String(
      <ManagePage
        email="test@example.com"
        subscription={sub}
        csrfToken={undefined}
      />,
    );

    expect(result).toContain("pill-warn");
    expect(result).toContain("past_due");
  });

  test("shows pill-stopped for canceled status", () => {
    const sub = createMockSubscription();
    sub.status = "canceled";
    const result = String(
      <ManagePage
        email="test@example.com"
        subscription={sub}
        csrfToken={undefined}
      />,
    );

    expect(result).toContain("pill-stopped");
    expect(result).toContain("canceled");
  });
});
