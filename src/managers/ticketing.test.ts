import { beforeEach, describe, expect, mock, test } from "bun:test";
import type Stripe from "stripe";
import { send as sendEmail } from "~/test-utils/resend.mock";
import * as ticketingManager from "./ticketing";

const paymentIntentsRetrieve = mock(
  (): Promise<Stripe.PaymentIntent> =>
    Promise.resolve({} as Stripe.PaymentIntent),
);
const paymentIntentsList = mock((): AsyncIterable<Stripe.PaymentIntent> => ({
  async *[Symbol.asyncIterator]() {},
}));
const paymentIntentsCreate = mock(
  (): Promise<Stripe.PaymentIntent> =>
    Promise.resolve({} as Stripe.PaymentIntent),
);
const paymentIntentsCancel = mock(
  (): Promise<Stripe.PaymentIntent> =>
    Promise.resolve({} as Stripe.PaymentIntent),
);
const chargesRetrieve = mock(
  (): Promise<Stripe.Charge> => Promise.resolve({} as Stripe.Charge),
);

mock.module("~/services/stripe", () => ({
  default: {
    paymentIntents: {
      retrieve: paymentIntentsRetrieve,
      list: paymentIntentsList,
      create: paymentIntentsCreate,
      cancel: paymentIntentsCancel,
    },
    charges: { retrieve: chargesRetrieve },
  },
}));

let listedPaymentIntents: Stripe.PaymentIntent[] = [];

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
    Pick<
      Stripe.PaymentIntent,
      | "id"
      | "client_secret"
      | "metadata"
      | "status"
      | "created"
      | "latest_charge"
    >
  > = {},
): Stripe.PaymentIntent {
  return {
    id: overrides.id ?? "pi_1",
    client_secret:
      "client_secret" in overrides
        ? overrides.client_secret
        : "pi_1_secret_abc",
    metadata: overrides.metadata ?? ticketMetadata(),
    status: overrides.status ?? "succeeded",
    created: overrides.created ?? Math.floor(Date.now() / 1000),
    latest_charge:
      "latest_charge" in overrides
        ? overrides.latest_charge
        : ({ refunded: false } as Stripe.Charge),
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
  paymentIntentsList.mockReset();
  paymentIntentsList.mockImplementation(() => ({
    async *[Symbol.asyncIterator]() {
      yield* listedPaymentIntents;
    },
  }));
  paymentIntentsCreate.mockReset();
  paymentIntentsCreate.mockResolvedValue(makePaymentIntent());
  paymentIntentsCancel.mockReset();
  paymentIntentsCancel.mockResolvedValue(makePaymentIntent());
  chargesRetrieve.mockReset();
  listedPaymentIntents = [];
  ticketingManager.invalidateAvailabilityCache();
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

  describe("getAvailability", () => {
    test("counts paid and active tickets but excludes fully refunded tickets", async () => {
      listedPaymentIntents = [
        makePaymentIntent({ metadata: ticketMetadata({ quantity: "3" }) }),
        makePaymentIntent({
          id: "pi_refunded",
          metadata: ticketMetadata({ quantity: "2" }),
          latest_charge: { refunded: true } as Stripe.Charge,
        }),
        makePaymentIntent({
          id: "pi_partially_refunded",
          metadata: ticketMetadata({ quantity: "4" }),
          latest_charge: {
            refunded: false,
            amount_refunded: 100,
          } as Stripe.Charge,
        }),
        makePaymentIntent({
          id: "pi_pending",
          metadata: ticketMetadata({ quantity: "1" }),
          status: "requires_payment_method",
          latest_charge: null,
        }),
        makePaymentIntent({
          id: "pi_canceled",
          metadata: ticketMetadata({ quantity: "5" }),
          status: "canceled",
          latest_charge: null,
        }),
        makePaymentIntent({ id: "pi_donation", metadata: {} }),
      ];

      await expect(ticketingManager.getAvailability()).resolves.toEqual({
        capacity: 150,
        sold: 7,
        claimed: 8,
        remaining: 142,
      });
      expect(paymentIntentsList).toHaveBeenCalledWith({
        created: { gte: expect.any(Number) },
        expand: ["data.latest_charge"],
        limit: 100,
      });
    });

    test("retrieves an unexpanded charge before counting a refund", async () => {
      listedPaymentIntents = [
        makePaymentIntent({ latest_charge: "ch_refunded" }),
      ];
      chargesRetrieve.mockResolvedValue({ refunded: true } as Stripe.Charge);

      const availability = await ticketingManager.getAvailability();

      expect(availability?.sold).toBe(0);
      expect(chargesRetrieve).toHaveBeenCalledWith("ch_refunded");
    });

    test("cancels expired checkout reservations", async () => {
      listedPaymentIntents = [
        makePaymentIntent({
          id: "pi_expired",
          status: "requires_action",
          created: 0,
          latest_charge: null,
        }),
      ];

      await expect(ticketingManager.getAvailability()).resolves.toEqual({
        capacity: 150,
        sold: 0,
        claimed: 0,
        remaining: 150,
      });
      expect(paymentIntentsCancel).toHaveBeenCalledWith("pi_expired");
    });

    test("keeps an expired reservation claimed when Stripe cannot cancel it", async () => {
      listedPaymentIntents = [
        makePaymentIntent({
          id: "pi_expired",
          status: "requires_action",
          created: 0,
          latest_charge: null,
        }),
      ];
      paymentIntentsCancel.mockRejectedValue(new Error("Stripe error"));

      const availability = await ticketingManager.getAvailability();

      expect(availability?.claimed).toBe(3);
      expect(availability?.remaining).toBe(147);
    });

    test("fails closed when Stripe availability cannot be read", async () => {
      paymentIntentsList.mockImplementation(() => {
        throw new Error("Stripe error");
      });

      await expect(ticketingManager.getAvailability()).resolves.toBeNull();
    });
  });

  describe("purchase", () => {
    test("creates a ticket payment at the $13.37 minimum", async () => {
      const result = await ticketingManager.purchase(
        { cents: 1337 },
        2,
        "buyer@example.com",
      );

      expect(result).toEqual({
        success: true,
        clientSecret: "pi_1_secret_abc",
      });
      expect(paymentIntentsCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          amount: 2674,
          metadata: expect.objectContaining({
            quantity: "2",
            unitPrice: "1337",
          }),
        }),
      );
    });

    test("rejects a price below $13.37", async () => {
      await expect(
        ticketingManager.purchase({ cents: 1336 }, 1, "buyer@example.com"),
      ).resolves.toEqual({
        success: false,
        error: "InvalidDonationAmount",
      });
      expect(paymentIntentsCreate).not.toHaveBeenCalled();
    });

    test("rejects a purchase that would exceed 150 claimed tickets", async () => {
      listedPaymentIntents = Array.from({ length: 7 }, (_, index) =>
        makePaymentIntent({
          id: `pi_${index}`,
          metadata: ticketMetadata({ quantity: "20" }),
        }),
      );
      listedPaymentIntents.push(
        makePaymentIntent({
          id: "pi_8",
          metadata: ticketMetadata({ quantity: "9" }),
        }),
      );

      await expect(
        ticketingManager.purchase({ cents: 6400 }, 2, "buyer@example.com"),
      ).resolves.toEqual({ success: false, error: "TicketsSoldOut" });
      expect(paymentIntentsCreate).not.toHaveBeenCalled();
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
