import { beforeEach, describe, expect, mock, test } from "bun:test";
import type Stripe from "stripe";
import { send as sendEmail } from "~/test-utils/resend.mock";
import * as ticketingManager from "./ticketing";

const paymentIntentsRetrieve = mock(
  (): Promise<Stripe.PaymentIntent> =>
    Promise.resolve({} as Stripe.PaymentIntent),
);

mock.module("~/services/stripe", () => ({
  default: {
    paymentIntents: { retrieve: paymentIntentsRetrieve },
  },
}));

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

function makePaymentIntent(
  overrides: Partial<
    Pick<Stripe.PaymentIntent, "id" | "client_secret" | "metadata">
  > = {},
): Stripe.PaymentIntent {
  return {
    id: overrides.id ?? "pi_1",
    client_secret:
      "client_secret" in overrides
        ? overrides.client_secret
        : "pi_1_secret_abc",
    metadata: overrides.metadata ?? ticketMetadata(),
  } as unknown as Stripe.PaymentIntent;
}

beforeEach(() => {
  sendEmail.mockReset();
  sendEmail.mockResolvedValue({
    data: { id: "email_mock" },
    error: null,
    headers: null,
  });
  paymentIntentsRetrieve.mockReset();
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

  describe("getPurchaseConfirmation", () => {
    test("returns the buyer email when the client secret matches", async () => {
      paymentIntentsRetrieve.mockResolvedValue(makePaymentIntent());

      const result = await ticketingManager.getPurchaseConfirmation(
        "pi_1",
        "pi_1_secret_abc",
      );

      expect(result).toEqual({ email: "buyer@example.com" });
      expect(paymentIntentsRetrieve).toHaveBeenCalledWith("pi_1");
    });

    test("returns null when the payment intent id is missing", async () => {
      const result = await ticketingManager.getPurchaseConfirmation(
        undefined,
        "pi_1_secret_abc",
      );

      expect(result).toBeNull();
      expect(paymentIntentsRetrieve).not.toHaveBeenCalled();
    });

    test("returns null when the client secret is missing", async () => {
      const result = await ticketingManager.getPurchaseConfirmation(
        "pi_1",
        undefined,
      );

      expect(result).toBeNull();
      expect(paymentIntentsRetrieve).not.toHaveBeenCalled();
    });

    test("returns null when the client secret does not match", async () => {
      paymentIntentsRetrieve.mockResolvedValue(makePaymentIntent());

      const result = await ticketingManager.getPurchaseConfirmation(
        "pi_1",
        "pi_1_secret_wrong",
      );

      expect(result).toBeNull();
    });

    test("returns null when the purchase is not a ticket", async () => {
      paymentIntentsRetrieve.mockResolvedValue(
        makePaymentIntent({ metadata: {} }),
      );

      const result = await ticketingManager.getPurchaseConfirmation(
        "pi_1",
        "pi_1_secret_abc",
      );

      expect(result).toBeNull();
    });

    test("returns null when the ticket has no email", async () => {
      paymentIntentsRetrieve.mockResolvedValue(
        makePaymentIntent({ metadata: ticketMetadata({ email: "" }) }),
      );

      const result = await ticketingManager.getPurchaseConfirmation(
        "pi_1",
        "pi_1_secret_abc",
      );

      expect(result).toBeNull();
    });

    test("returns null when retrieving the payment intent fails", async () => {
      paymentIntentsRetrieve.mockRejectedValue(new Error("Stripe error"));

      const result = await ticketingManager.getPurchaseConfirmation(
        "pi_1",
        "pi_1_secret_abc",
      );

      expect(result).toBeNull();
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
