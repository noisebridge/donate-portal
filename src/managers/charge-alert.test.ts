import { describe, expect, test } from "bun:test";
import type Stripe from "stripe";
import { ChargeAlertManager } from "./charge-alert";

describe("ChargeAlertManager", () => {
  const manager = new ChargeAlertManager();

  describe("getProductName", () => {
    test("censors profanity in product names", () => {
      const paymentIntent = {
        metadata: { name: "fuck" },
        description: null,
      } as unknown as Stripe.PaymentIntent;

      const name = manager["getProductName"](paymentIntent);

      expect(name).not.toContain("fuck");
      expect(name).toHaveLength(4);
    });
  });
});
