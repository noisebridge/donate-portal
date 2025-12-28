import { describe, expect, test } from "bun:test";
import { SubscriptionPastDueEmail } from "./subscription-past-due";

describe("SubscriptionPastDueEmail", () => {
  test("should generate email template with amount", () => {
    const result = SubscriptionPastDueEmail({
      amount: { cents: 1000 },
    });

    expect(result).toBeTypeOf("string");
    expect(result).toInclude("$10.00");
  });

  test("should generate email template without amount", () => {
    const result = SubscriptionPastDueEmail({});

    expect(result).toBeTypeOf("string");
    expect(result).not.toInclude("$");
  });
});
