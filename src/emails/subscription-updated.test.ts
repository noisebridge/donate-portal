import { describe, expect, test } from "bun:test";
import { SubscriptionUpdatedEmail } from "./subscription-updated";

describe("SubscriptionUpdatedEmail", () => {
  test("should generate email template with old and new amounts", () => {
    const result = SubscriptionUpdatedEmail({
      oldAmount: { cents: 1000 },
      newAmount: { cents: 2500 },
    });

    expect(result).toBeTypeOf("string");
    expect(result).toInclude("$10.00");
    expect(result).toInclude("$25.00");
  });
});
