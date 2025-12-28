import { describe, expect, test } from "bun:test";
import { SubscriptionWelcomeEmail } from "./subscription-welcome";

describe("SubscriptionWelcomeEmail", () => {
  test("should generate email template with amount", () => {
    const result = SubscriptionWelcomeEmail({
      amount: { cents: 2500 },
    });

    expect(result).toBeTypeOf("string");
    expect(result).toInclude("$25.00");
  });
});
