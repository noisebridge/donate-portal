import { describe, expect, test } from "bun:test";
import type Stripe from "stripe";
import { ChargeAlertManager } from "./charge-alert";
import { GENERAL_DONATION } from "./donation";
import { PRODUCT_ID } from "./subscription";

describe("ChargeAlertManager", () => {
  const manager = new ChargeAlertManager();

  function makePaymentIntent(
    overrides: Partial<
      Pick<Stripe.PaymentIntent, "id" | "customer" | "metadata" | "description">
    > = {},
  ): Stripe.PaymentIntent {
    return {
      id: overrides.id ?? "pi_1",
      customer: overrides.customer ?? null,
      metadata: overrides.metadata ?? {},
      description: overrides.description ?? null,
    } as unknown as Stripe.PaymentIntent;
  }

  function makeSubscription(
    product: Stripe.Product | string | null,
    id = "sub_1",
  ): Stripe.Subscription {
    const data = product ? [{ plan: { product } }] : [];
    return { id, items: { data } } as unknown as Stripe.Subscription;
  }

  describe("getProductName", () => {
    test("censors profanity in product names", () => {
      const paymentIntent = makePaymentIntent({ metadata: { name: "fuck" } });

      const name = manager["getProductName"](paymentIntent);

      expect(name).not.toContain("fuck");
      expect(name).toHaveLength(4);
    });

    // Allow for our "Give a shit" donations to pass through the filter
    test("allows 'shit' through the profanity filter", () => {
      const paymentIntent = makePaymentIntent({
        metadata: { name: "A shit" },
      });

      expect(manager["getProductName"](paymentIntent)).toBe("A shit");
    });

    test("leaves clean names unchanged", () => {
      const paymentIntent = makePaymentIntent({
        metadata: { name: "Pizza Fund" },
      });

      expect(manager["getProductName"](paymentIntent)).toBe("Pizza Fund");
    });

    test("returns GENERAL_DONATION when name and description are missing", () => {
      const paymentIntent = makePaymentIntent();

      expect(manager["getProductName"](paymentIntent)).toBe(GENERAL_DONATION);
    });

    test("falls back to description when metadata name is absent", () => {
      const paymentIntent = makePaymentIntent({ description: "Snacks" });

      expect(manager["getProductName"](paymentIntent)).toBe("Snacks");
    });
  });

  describe("createObjectId", () => {
    test("is deterministic for the same input", () => {
      const obj = { id: "pi_abc" } as Stripe.PaymentIntent;

      expect(manager["createObjectId"](obj)).toBe(
        manager["createObjectId"](obj),
      );
    });

    test("returns different output for different inputs", () => {
      const a = { id: "pi_1" } as Stripe.PaymentIntent;
      const b = { id: "pi_2" } as Stripe.PaymentIntent;

      expect(manager["createObjectId"](a)).not.toBe(
        manager["createObjectId"](b),
      );
    });
  });

  describe("isMembership", () => {
    test("returns true when product is the matching string id", () => {
      const subscription = makeSubscription(PRODUCT_ID);

      expect(manager["isMembership"](subscription)).toBe(true);
    });

    test("returns true when product is an expanded object with the matching id", () => {
      const subscription = makeSubscription({
        id: PRODUCT_ID,
      } as Stripe.Product);

      expect(manager["isMembership"](subscription)).toBe(true);
    });

    test("returns false for a non-matching product", () => {
      const subscription = makeSubscription("some_other_product");

      expect(manager["isMembership"](subscription)).toBe(false);
    });

    test("returns false when subscription has no items", () => {
      const subscription = makeSubscription(null);

      expect(manager["isMembership"](subscription)).toBe(false);
    });
  });
});
