import { beforeEach, describe, expect, test } from "bun:test";
import type Stripe from "stripe";
import { send as sendEmail } from "~/test-utils/resend.mock";
import * as ticketingManager from "./ticketing";

function makeSucceededEvent(
  overrides: Partial<
    Pick<Stripe.PaymentIntent, "id" | "metadata" | "amount">
  > = {},
): Stripe.PaymentIntentSucceededEvent {
  return {
    type: "payment_intent.succeeded",
    data: {
      object: {
        id: overrides.id ?? "pi_1",
        amount: overrides.amount ?? 7500,
        metadata: overrides.metadata ?? {},
      },
    },
  } as unknown as Stripe.PaymentIntentSucceededEvent;
}

function ticketMetadata(
  overrides: Record<string, string> = {},
): Record<string, string> {
  return {
    name: ticketingManager.PRODUCT_NAME,
    type: ticketingManager.TICKET_TYPE,
    quantity: "3",
    unitPrice: "2500",
    email: "buyer@example.com",
    ...overrides,
  };
}

beforeEach(() => {
  sendEmail.mockReset();
  sendEmail.mockResolvedValue({
    data: { id: "email_mock" },
    error: null,
    headers: null,
  });
});

describe("afterparty", () => {
  describe("validateQuantity", () => {
    test("accepts quantities within bounds", () => {
      expect(ticketingManager.validateQuantity(1)).toBe(true);
      expect(ticketingManager.validateQuantity(20)).toBe(true);
    });

    test("rejects zero, negatives and out-of-range values", () => {
      expect(ticketingManager.validateQuantity(0)).toBe(false);
      expect(ticketingManager.validateQuantity(-1)).toBe(false);
      expect(ticketingManager.validateQuantity(21)).toBe(false);
    });

    test("rejects non-integers", () => {
      expect(ticketingManager.validateQuantity(1.5)).toBe(false);
      expect(ticketingManager.validateQuantity(Number.NaN)).toBe(false);
    });
  });

  describe("isTicketPurchase", () => {
    test("is true for ticket metadata", () => {
      const paymentIntent = {
        metadata: { type: ticketingManager.TICKET_TYPE },
      } as unknown as Stripe.PaymentIntent;
      expect(ticketingManager.isTicketPurchase(paymentIntent)).toBe(true);
    });

    test("is false for a plain donation", () => {
      const paymentIntent = { metadata: {} } as unknown as Stripe.PaymentIntent;
      expect(ticketingManager.isTicketPurchase(paymentIntent)).toBe(false);
    });
  });

  describe("handlePaymentSuccess", () => {
    test("sends the ticket email for a ticket purchase", async () => {
      await ticketingManager.handlePaymentSuccess(
        makeSucceededEvent({ metadata: ticketMetadata() }),
      );

      expect(sendEmail).toHaveBeenCalledTimes(1);
      expect(sendEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: "buyer@example.com",
          html: expect.stringContaining("3 tickets"),
        }),
      );
    });

    test("ignores payment intents that aren't tickets", async () => {
      await ticketingManager.handlePaymentSuccess(
        makeSucceededEvent({ metadata: {} }),
      );

      expect(sendEmail).not.toHaveBeenCalled();
    });

    test("skips tickets missing an email", async () => {
      await ticketingManager.handlePaymentSuccess(
        makeSucceededEvent({ metadata: ticketMetadata({ email: "" }) }),
      );

      expect(sendEmail).not.toHaveBeenCalled();
    });

    test("skips tickets with an invalid quantity", async () => {
      await ticketingManager.handlePaymentSuccess(
        makeSucceededEvent({ metadata: ticketMetadata({ quantity: "0" }) }),
      );

      expect(sendEmail).not.toHaveBeenCalled();
    });
  });
});
