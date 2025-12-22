import { describe, expect, test } from "bun:test";
import { SubscriptionCanceledEmail } from "./subscription-canceled";

describe("SubscriptionCanceledEmail", () => {
  test("should generate email template", () => {
    const result = SubscriptionCanceledEmail({
      amount: { cents: 2500 },
    });

    expect(result).toBeTypeOf("string");
    expect(result).toInclude("$25.00");
  });
});
