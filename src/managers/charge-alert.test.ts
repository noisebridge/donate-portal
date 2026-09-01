import { describe, expect, mock, test } from "bun:test";
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
  describe("formatChargeAlert", () => {
    test("converts a payment intent into a charge alert", () => {
      const paymentIntent = makePaymentIntent({ metadata: { name: "Snacks" } });
      paymentIntent.created = 1_700_000_000;
      paymentIntent.amount = 1234;

      expect(manager["formatChargeAlert"](paymentIntent)).toEqual({
        type: "charge_alert",
        id: manager["createObjectId"](paymentIntent),
        date: new Date(1_700_000_000 * 1000).toISOString(),
        amount: { cents: 1234 },
        productName: "Snacks",
      });
    });

    test("defaults a missing amount to zero cents", () => {
      const paymentIntent = makePaymentIntent();
      paymentIntent.created = 1_700_000_000;
      paymentIntent.amount = undefined as unknown as number;

      expect(manager["formatChargeAlert"](paymentIntent).amount).toEqual({
        cents: 0,
      });
    });
  });

  describe("formatMemberAlert", () => {
    test("converts a subscription into a member alert", () => {
      const subscription = makeSubscription(PRODUCT_ID);
      subscription.created = 1_700_000_000;

      expect(manager["formatMemberAlert"](subscription)).toEqual({
        type: "member_alert",
        id: manager["createObjectId"](subscription),
        date: new Date(1_700_000_000 * 1000).toISOString(),
        productName: "New Member",
      });
    });
  });

  describe("isDonation", () => {
    test("returns true when there is no customer", () => {
      expect(manager["isDonation"](makePaymentIntent())).toBe(true);
    });

    test("returns false when a customer is attached", () => {
      const paymentIntent = makePaymentIntent({ customer: "cus_1" });

      expect(manager["isDonation"](paymentIntent)).toBe(false);
    });
  });

  describe("connections", () => {
    function makeSocket() {
      const handlers = new Map<string, (data?: unknown) => void>();

      return {
        handlers,
        send: mock((_data?: unknown) => {}),
        terminate: mock(() => {}),
        on(event: string, handler: (data?: unknown) => void) {
          handlers.set(event, handler);
        },
        emit(event: string, data?: unknown) {
          handlers.get(event)?.(data);
        },
      };
    }

    type FakeSocket = ReturnType<typeof makeSocket>;

    function connect(target: ChargeAlertManager, socket: FakeSocket) {
      return target.addConnection(
        socket as unknown as Parameters<ChargeAlertManager["addConnection"]>[0],
      );
    }

    /** A manager with its Stripe-backed alert history pre-seeded. */
    function seededManager() {
      const seeded = new ChargeAlertManager();
      seeded["_recentAlerts"] = [];
      return seeded;
    }

    test("broadcasts an alert to every connected socket", async () => {
      const target = seededManager();
      const socket = makeSocket();
      await connect(target, socket);

      await target["broadcastAlert"]({
        type: "member_alert",
        id: "abc",
        date: new Date().toISOString(),
        productName: "New Member",
      });

      expect(socket.send).toHaveBeenCalledTimes(1);
      expect(await target.getRecentAlerts()).toHaveLength(1);
    });

    test("drops a socket that throws while being broadcast to", async () => {
      const target = seededManager();
      const socket = makeSocket();
      socket.send.mockImplementation(() => {
        throw new Error("socket closed");
      });
      await connect(target, socket);

      await target["broadcastAlert"]({
        type: "member_alert",
        id: "abc",
        date: new Date().toISOString(),
        productName: "New Member",
      });

      expect(socket.terminate).toHaveBeenCalledTimes(1);
      expect(target["connections"].size).toBe(0);
    });

    test("caps the alert history", async () => {
      const target = seededManager();
      target["_recentAlerts"] = Array.from({ length: 20 }, (_, index) => ({
        type: "member_alert" as const,
        id: `id_${index}`,
        date: new Date().toISOString(),
        productName: "New Member",
      }));

      await target["broadcastAlert"]({
        type: "member_alert",
        id: "newest",
        date: new Date().toISOString(),
        productName: "New Member",
      });

      const history = await target.getRecentAlerts();
      expect(history).toHaveLength(20);
      expect(history[0]?.id).toBe("newest");
    });

    test("marks a connection alive again on a pong message", async () => {
      const target = seededManager();
      const socket = makeSocket();
      await connect(target, socket);
      const state = target["connections"].get(
        socket as unknown as Parameters<ChargeAlertManager["addConnection"]>[0],
      );
      // biome-ignore lint/style/noNonNullAssertion: the connection was just added
      state!.alive = false;

      socket.emit("message", JSON.stringify({ type: "pong" }));

      expect(state?.alive).toBe(true);
    });

    test("survives an unparseable client message", async () => {
      const target = seededManager();
      const socket = makeSocket();
      await connect(target, socket);

      expect(() => socket.emit("message", "not json")).not.toThrow();
      expect(target["connections"].size).toBe(1);
    });

    test("terminates and forgets a socket that errors", async () => {
      const target = seededManager();
      const socket = makeSocket();
      await connect(target, socket);

      socket.emit("error", new Error("boom"));

      expect(socket.terminate).toHaveBeenCalledTimes(1);
      expect(target["connections"].size).toBe(0);
    });

    test("forgets a socket that closes", async () => {
      const target = seededManager();
      const socket = makeSocket();
      await connect(target, socket);

      socket.emit("close");

      expect(target["connections"].size).toBe(0);
    });

    test("sends recent history in a ping", async () => {
      const target = seededManager();
      target["_recentAlerts"] = Array.from({ length: 8 }, (_, index) => ({
        type: "member_alert" as const,
        id: `id_${index}`,
        date: new Date().toISOString(),
        productName: "New Member",
      }));
      const socket = makeSocket();
      await connect(target, socket);

      await target["sendPing"](
        socket as unknown as Parameters<ChargeAlertManager["addConnection"]>[0],
      );

      const message = JSON.parse(String(socket.send.mock.calls[0]?.[0]));
      expect(message.type).toBe("ping");
      expect(message.history).toHaveLength(5);
    });

    test("drops a socket that throws while being pinged", async () => {
      const target = seededManager();
      const socket = makeSocket();
      socket.send.mockImplementation(() => {
        throw new Error("socket closed");
      });
      await connect(target, socket);

      await target["sendPing"](
        socket as unknown as Parameters<ChargeAlertManager["addConnection"]>[0],
      );

      expect(socket.terminate).toHaveBeenCalledTimes(1);
      expect(target["connections"].size).toBe(0);
    });
  });
});
