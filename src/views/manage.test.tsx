import { describe, expect, test } from "bun:test";
import { createMockSubscription } from "~/test-utils/mock-subscription";
import { ManagePage } from "./manage";

describe("ManagePage", () => {
  test("should render with email", async () => {
    const result = await (<ManagePage email="test@example.com" />);

    expect(result).toBeTypeOf("string");
    expect(result).toContain("test@example.com");
  });

  test("should display error message when provided", async () => {
    const errorMessage = "Failed to update subscription";
    const result = await (
      <ManagePage
        email="test@example.com"
        messages={[{ type: "error", text: errorMessage }]}
      />
    );

    expect(result).toBeTypeOf("string");
    expect(result).toContain(errorMessage);
    expect(result).toContain('class="message message-error"');
  });

  test("should display info message when provided", async () => {
    const infoMessage = "Your donation amount has been updated.";
    const result = await (
      <ManagePage
        email="test@example.com"
        messages={[{ type: "info", text: infoMessage }]}
      />
    );

    expect(result).toBeTypeOf("string");
    expect(result).toContain(infoMessage);
    expect(result).toContain('class="message message-info"');
  });

  test("should not display message when no messages provided", async () => {
    const result = await (<ManagePage email="test@example.com" />);

    expect(result).toBeTypeOf("string");
    expect(result).not.toContain('class="message ');
  });

  test("should display cancel form when subscription exists", async () => {
    const result = await (
      <ManagePage
        email="test@example.com"
        subscription={createMockSubscription()}
      />
    );

    expect(result).toBeTypeOf("string");
    expect(result).toContain("Cancel subscription");
  });

  test("status strip shows tier, amount, and renewal date", async () => {
    const result = await (
      <ManagePage
        email="test@example.com"
        subscription={createMockSubscription({ unitAmount: 10000 })}
      />
    );

    expect(result).toContain('class="status-strip"');
    expect(result).toContain("Employed Hacker");
    expect(result).toContain("$100.00");
    expect(result).toContain("Jan");
    expect(result).toContain("2025");
    expect(result).toContain("pill-ok");
    expect(result).toContain("active");
  });

  test("status strip shows 'Custom' tier name for non-standard amount", async () => {
    const result = await (
      <ManagePage
        email="test@example.com"
        subscription={createMockSubscription({ unitAmount: 7500 })}
      />
    );

    expect(result).toContain("Custom");
    expect(result).toContain("$75.00");
  });

  test("shows no-subscription notice when no subscription", async () => {
    const result = await (<ManagePage email="test@example.com" />);

    expect(result).toContain('class="status-null"');
    expect(result).not.toContain('class="status-strip"');
  });

  test("should display portal form when subscription exists", async () => {
    const result = await (
      <ManagePage
        email="test@example.com"
        subscription={createMockSubscription()}
      />
    );

    expect(result).toBeTypeOf("string");
    expect(result).toContain('action="/subscribe/portal"');
    expect(result).toContain("Past invoices");
  });

  test("should not display portal form without subscription", async () => {
    const result = await (<ManagePage email="test@example.com" />);

    expect(result).toBeTypeOf("string");
    expect(result).not.toContain('action="/subscribe/portal"');
  });

  test("shows pill-warn for past_due status", async () => {
    const sub = createMockSubscription();
    sub.status = "past_due";
    const result = await (
      <ManagePage email="test@example.com" subscription={sub} />
    );

    expect(result).toContain("pill-warn");
    expect(result).toContain("past_due");
  });

  test("shows pill-stopped for canceled status", async () => {
    const sub = createMockSubscription();
    sub.status = "canceled";
    const result = await (
      <ManagePage email="test@example.com" subscription={sub} />
    );

    expect(result).toContain("pill-stopped");
    expect(result).toContain("canceled");
  });
});
