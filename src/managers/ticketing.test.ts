import { beforeEach, describe, expect, mock, test } from "bun:test";
import type Stripe from "stripe";
import { send as sendEmail } from "~/test-utils/resend.mock";
import * as ticketingManager from "./ticketing";

const paymentIntentsRetrieve = mock(
  (): Promise<Stripe.PaymentIntent> =>
    Promise.resolve({} as Stripe.PaymentIntent),
);
const paymentIntentsList = mock(
  (): AsyncIterable<Stripe.PaymentIntent> => ({
    async *[Symbol.asyncIterator]() {},
  }),
);
const paymentIntentsCreate = mock(
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
    },
    charges: { retrieve: chargesRetrieve },
  },
}));

let listedPaymentIntents: Stripe.PaymentIntent[] = [];
const purchaseId = "123e4567-e89b-42d3-a456-426614174000";

function makeSucceededEvent(
  overrides: Partial<
    Pick<Stripe.PaymentIntent, "id" | "metadata" | "amount" | "currency">
  > = {},
): Stripe.PaymentIntentSucceededEvent {
  return {
    type: "payment_intent.succeeded",
    data: {
      object: {
        id: overrides.id ?? "pi_1",
        amount: overrides.amount ?? 7500,
        currency: overrides.currency ?? "usd",
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
    eventId: ticketingManager.TICKET_EVENT_ID,
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
      | "amount"
      | "client_secret"
      | "currency"
      | "metadata"
      | "status"
      | "created"
      | "latest_charge"
    >
  > = {},
): Stripe.PaymentIntent {
  const metadata = overrides.metadata ?? ticketMetadata();
  const quantity = Number(metadata["quantity"]);
  const unitPrice = Number(metadata["unitPrice"]);
  return {
    id: overrides.id ?? "pi_1",
    amount: overrides.amount ?? quantity * unitPrice,
    client_secret:
      "client_secret" in overrides
        ? overrides.client_secret
        : "pi_1_secret_abc",
    currency: overrides.currency ?? "usd",
    metadata,
    status: overrides.status ?? "succeeded",
    created: overrides.created ?? Math.floor(Date.now() / 1000),
    latest_charge:
      "latest_charge" in overrides
        ? overrides.latest_charge
        : ({ amount_refunded: 0, refunded: false } as Stripe.Charge),
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
  chargesRetrieve.mockReset();
  listedPaymentIntents = [];
});

describe("afterparty", () => {
  describe("calendar", () => {
    test("uses the 9 PM to 1 AM event hours", () => {
      expect(ticketingManager.calendarEvent()).toContain(
        "DTSTART:20260720T040000Z",
      );
      expect(ticketingManager.calendarEvent()).toContain(
        "DTEND:20260720T080000Z",
      );

      const links = ticketingManager.calendarLinks();
      expect(links.google).toContain(
        "dates=20260720T040000Z%2F20260720T080000Z",
      );
      expect(links.outlook).toContain("startdt=2026-07-20T04%3A00%3A00Z");
      expect(links.outlook).toContain("enddt=2026-07-20T08%3A00%3A00Z");
      expect(links.microsoft365).toContain("startdt=2026-07-20T04%3A00%3A00Z");
      expect(links.yahoo).toContain("st=20260720T040000Z");
      expect(links.yahoo).toContain("et=20260720T080000Z");
    });
  });

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
        metadata: ticketMetadata(),
      } as unknown as Stripe.PaymentIntent;
      expect(ticketingManager.isTicketPurchase(paymentIntent)).toBe(true);
    });

    test("recognizes tickets created before the event id was added", () => {
      const { eventId: _eventId, ...metadata } = ticketMetadata();
      const paymentIntent = { metadata } as unknown as Stripe.PaymentIntent;

      expect(ticketingManager.isTicketPurchase(paymentIntent)).toBe(true);
    });

    test("is false for donations and other ticketed events", () => {
      const paymentIntents = [
        { metadata: {} },
        { metadata: { name: ticketingManager.PRODUCT_NAME } },
        {
          metadata: {
            name: ticketingManager.PRODUCT_NAME,
            type: "donation",
          },
        },
        {
          metadata: ticketMetadata({ eventId: "another_event" }),
        },
      ] as unknown as Stripe.PaymentIntent[];

      for (const paymentIntent of paymentIntents) {
        expect(ticketingManager.isTicketPurchase(paymentIntent)).toBe(false);
      }
    });
  });

  describe("parseQuantity", () => {
    test("accepts only canonical quantities from 1 through 20", () => {
      expect(ticketingManager.parseQuantity("1")).toBe(1);
      expect(ticketingManager.parseQuantity("20")).toBe(20);
      expect(ticketingManager.parseQuantity("0")).toBeNull();
      expect(ticketingManager.parseQuantity("21")).toBeNull();
      expect(ticketingManager.parseQuantity("1ticket")).toBeNull();
      expect(ticketingManager.parseQuantity(" 1 ")).toBeNull();
      expect(ticketingManager.parseQuantity("01")).toBeNull();
      expect(ticketingManager.parseQuantity(undefined)).toBeNull();
    });
  });

  describe("validatePurchaseId", () => {
    test("accepts UUIDv4 purchase ids only", () => {
      expect(ticketingManager.validatePurchaseId(purchaseId)).toBe(true);
      expect(ticketingManager.validatePurchaseId("not-a-uuid")).toBe(false);
      expect(
        ticketingManager.validatePurchaseId(
          "123e4567-e89b-12d3-a456-426614174000",
        ),
      ).toBe(false);
      expect(ticketingManager.validatePurchaseId(undefined)).toBe(false);
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
          metadata: ticketMetadata({ quantity: "5", unitPrice: "100" }),
          status: "canceled",
          latest_charge: null,
        }),
        makePaymentIntent({ id: "pi_donation", metadata: {} }),
        makePaymentIntent({
          id: "pi_same_name_donation",
          metadata: { name: ticketingManager.PRODUCT_NAME },
        }),
        makePaymentIntent({
          id: "pi_other_event",
          metadata: ticketMetadata({
            eventId: "another_event",
            quantity: "20",
          }),
        }),
      ];

      await expect(ticketingManager.getAvailability()).resolves.toEqual({
        capacity: 250,
        sold: 7,
        claimed: 8,
        remaining: 242,
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

    test("counts a valid historical ticket below the current minimum price", async () => {
      listedPaymentIntents = [
        makePaymentIntent({
          amount: 100,
          metadata: ticketMetadata({ quantity: "1", unitPrice: "100" }),
        }),
      ];

      expect((await ticketingManager.getAvailability())?.sold).toBe(1);
    });

    test("ignores ticket records with invalid quantities", async () => {
      listedPaymentIntents = [
        makePaymentIntent({
          metadata: ticketMetadata({ quantity: "3tickets" }),
        }),
      ];

      expect((await ticketingManager.getAvailability())?.sold).toBe(0);
    });

    test("ignores expired checkout reservations", async () => {
      listedPaymentIntents = [
        makePaymentIntent({
          id: "pi_expired",
          status: "requires_action",
          created: 0,
          latest_charge: null,
        }),
      ];

      await expect(ticketingManager.getAvailability()).resolves.toEqual({
        capacity: 250,
        sold: 0,
        claimed: 0,
        remaining: 250,
      });
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
        purchaseId,
      );

      expect(result).toEqual({
        success: true,
        clientSecret: "pi_1_secret_abc",
      });
      expect(paymentIntentsCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          amount: 2674,
          metadata: expect.objectContaining({
            eventId: ticketingManager.TICKET_EVENT_ID,
            purchaseId,
            quantity: "2",
            unitPrice: "1337",
          }),
        }),
        { idempotencyKey: `afterparty-${purchaseId}` },
      );
    });

    test("rejects a price below $13.37", async () => {
      await expect(
        ticketingManager.purchase(
          { cents: 1336 },
          1,
          "buyer@example.com",
          purchaseId,
        ),
      ).resolves.toEqual({
        success: false,
        error: "InvalidDonationAmount",
      });
      expect(paymentIntentsCreate).not.toHaveBeenCalled();
    });

    test("rejects non-integer and over-limit totals before calling Stripe", async () => {
      await expect(
        ticketingManager.purchase(
          { cents: Number.NaN },
          1,
          "buyer@example.com",
          purchaseId,
        ),
      ).resolves.toEqual({
        success: false,
        error: "InvalidDonationAmount",
      });
      await expect(
        ticketingManager.purchase(
          { cents: 5_000_000 },
          20,
          "buyer@example.com",
          purchaseId,
        ),
      ).resolves.toEqual({
        success: false,
        error: "InvalidDonationAmount",
      });
      expect(paymentIntentsList).not.toHaveBeenCalled();
      expect(paymentIntentsCreate).not.toHaveBeenCalled();
    });

    test("rejects a PaymentIntent that has no client secret", async () => {
      paymentIntentsCreate.mockResolvedValue(
        makePaymentIntent({ client_secret: null }),
      );

      await expect(
        ticketingManager.purchase(
          { cents: 6400 },
          1,
          "buyer@example.com",
          purchaseId,
        ),
      ).resolves.toEqual({ success: false, error: "SessionError" });
    });

    test("rejects a purchase that would exceed 250 claimed tickets", async () => {
      listedPaymentIntents = Array.from({ length: 12 }, (_, index) =>
        makePaymentIntent({
          id: `pi_${index}`,
          metadata: ticketMetadata({ quantity: "20" }),
        }),
      );
      listedPaymentIntents.push(
        makePaymentIntent({
          id: "pi_12",
          metadata: ticketMetadata({ quantity: "9" }),
        }),
      );

      await expect(
        ticketingManager.purchase(
          { cents: 6400 },
          2,
          "buyer@example.com",
          purchaseId,
        ),
      ).resolves.toEqual({ success: false, error: "TicketsSoldOut" });
      expect(paymentIntentsCreate).not.toHaveBeenCalled();
    });

    test("does not count an idempotent retry's existing reservation against itself", async () => {
      listedPaymentIntents = Array.from({ length: 12 }, (_, index) =>
        makePaymentIntent({
          id: `pi_${index}`,
          metadata: ticketMetadata({ quantity: "20" }),
        }),
      );
      listedPaymentIntents.push(
        makePaymentIntent({
          id: "pi_12",
          metadata: ticketMetadata({ quantity: "9" }),
        }),
        makePaymentIntent({
          id: "pi_retry",
          metadata: ticketMetadata({ quantity: "1", purchaseId }),
          status: "requires_payment_method",
          latest_charge: null,
        }),
      );

      await expect(
        ticketingManager.purchase(
          { cents: 6400 },
          1,
          "buyer@example.com",
          purchaseId,
        ),
      ).resolves.toEqual({
        success: true,
        clientSecret: "pi_1_secret_abc",
      });
      expect(paymentIntentsCreate).toHaveBeenCalledTimes(1);
    });
  });

  describe("getPurchaseConfirmation", () => {
    test("returns the buyer email when the client secret matches", async () => {
      paymentIntentsRetrieve.mockResolvedValue(makePaymentIntent());

      const result = await ticketingManager.getPurchaseConfirmation(
        "pi_1",
        "pi_1_secret_abc",
      );

      expect(result).toEqual({
        email: "buyer@example.com",
        status: "succeeded",
      });
      expect(paymentIntentsRetrieve).toHaveBeenCalledWith("pi_1");
    });

    test("reports processing status", async () => {
      paymentIntentsRetrieve.mockResolvedValue(
        makePaymentIntent({ status: "processing" }),
      );
      const result = await ticketingManager.getPurchaseConfirmation(
        "pi_1",
        "pi_1_secret_abc",
      );
      expect(result).toEqual({
        email: "buyer@example.com",
        status: "processing",
      });
    });

    test("reports incomplete status", async () => {
      paymentIntentsRetrieve.mockResolvedValue(
        makePaymentIntent({ status: "requires_payment_method" }),
      );
      const result = await ticketingManager.getPurchaseConfirmation(
        "pi_1",
        "pi_1_secret_abc",
      );
      expect(result).toEqual({
        email: "buyer@example.com",
        status: "incomplete",
      });
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
        { idempotencyKey: "afterparty-ticket-pi_1" },
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
