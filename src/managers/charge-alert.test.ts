import {
  afterAll,
  beforeAll,
  describe,
  expect,
  mock,
  setSystemTime,
  spyOn,
  test,
} from "bun:test";
import type Stripe from "stripe";
import { ChargeAlertManager } from "./charge-alert";
import { GENERAL_DONATION } from "./donation";
import { PRODUCT_ID } from "./subscription";

const paymentIntentsList = mock();
mock.module("~/services/stripe", () => ({
  default: { paymentIntents: { list: paymentIntentsList } },
}));

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
    const data = product ? [{ price: { product } }] : [];
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
        send: mock((_data?: unknown) => {}),
        ping: mock(() => {}),
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

    /** Connect `socket` and return its captured heartbeat tick. */
    function connect(target: ChargeAlertManager, socket: FakeSocket) {
      let tick = async () => {};
      const setIntervalSpy = spyOn(
        globalThis,
        "setInterval",
      ).mockImplementation(((fn: () => Promise<void>) => {
        tick = fn;
        return { unref() {} };
      }) as unknown as typeof setInterval);
      target.addConnection(
        socket as unknown as Parameters<ChargeAlertManager["addConnection"]>[0],
      );
      setIntervalSpy.mockRestore();

      return () => tick();
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
      connect(target, socket);

      await target["broadcastAlert"]({
        type: "member_alert",
        id: "abc",
        date: new Date().toISOString(),
        productName: "New Member",
      });

      expect(socket.send).toHaveBeenCalledTimes(1);
      expect(await target.getRecentAlerts()).toHaveLength(1);
    });

    test("caps the alert history", async () => {
      const target = seededManager();
      target["_recentAlerts"] = Array.from({ length: 25 }, (_, index) => ({
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
      expect(history).toHaveLength(25);
      expect(history[0]?.id).toBe("newest");
    });

    test("pings with recent history on each heartbeat", async () => {
      const target = seededManager();
      target["_recentAlerts"] = Array.from({ length: 8 }, (_, index) => ({
        type: "member_alert" as const,
        id: `id_${index}`,
        date: new Date().toISOString(),
        productName: "New Member",
      }));
      const socket = makeSocket();
      const tick = connect(target, socket);

      await tick();

      expect(socket.ping).toHaveBeenCalledTimes(1);
      const message = JSON.parse(String(socket.send.mock.calls[0]?.[0]));
      expect(message.type).toBe("ping");
      expect(message.history).toHaveLength(5);
    });

    test("keeps a socket that answers with a pong", async () => {
      const socket = makeSocket();
      const tick = connect(seededManager(), socket);

      await tick();
      socket.emit("pong");
      await tick();

      expect(socket.terminate).not.toHaveBeenCalled();
    });

    test("terminates a socket that misses a pong", async () => {
      const socket = makeSocket();
      const tick = connect(seededManager(), socket);

      await tick();
      await tick();

      expect(socket.terminate).toHaveBeenCalledTimes(1);
    });

    test("survives a socket error", () => {
      const socket = makeSocket();
      connect(seededManager(), socket);

      expect(() => socket.emit("error", new Error("boom"))).not.toThrow();
    });

    test("forgets a socket and stops its heartbeat when it closes", () => {
      const target = seededManager();
      const socket = makeSocket();
      connect(target, socket);
      const clearIntervalSpy = spyOn(globalThis, "clearInterval");

      socket.emit("close");

      expect(clearIntervalSpy).toHaveBeenCalledTimes(1);
      clearIntervalSpy.mockRestore();
      expect(target["sockets"].size).toBe(0);
    });
  });

  describe("top donations", () => {
    const inWindow = Date.parse("2026-10-17T12:00:00-07:00") / 1000;

    beforeAll(() => {
      setSystemTime(new Date(inWindow * 1000));
    });

    afterAll(() => {
      setSystemTime();
    });

    function makeSucceeded(id: string, amount: number, created = inWindow) {
      return {
        ...makePaymentIntent({ id }),
        status: "succeeded",
        amount,
        created,
      } as Stripe.PaymentIntent;
    }

    function stubList(paymentIntents: Stripe.PaymentIntent[]) {
      paymentIntentsList.mockReturnValue({
        autoPagingEach: async (fn: (pi: Stripe.PaymentIntent) => void) => {
          paymentIntents.forEach(fn);
        },
      });
    }

    test("returns fewer than three when the window has fewer donations", async () => {
      stubList([makeSucceeded("pi_small", 500), makeSucceeded("pi_big", 9000)]);

      const top = await new ChargeAlertManager().getTopDonations();

      expect(top?.map((d) => d.amount.cents)).toEqual([9000, 500]);
    });

    test("fills an open place with a new donation from the window", async () => {
      stubList([makeSucceeded("pi_first", 500)]);
      const target = new ChargeAlertManager();
      await target.getTopDonations();

      await target["recordTopDonation"](
        target["formatChargeAlert"](makeSucceeded("pi_new", 700)),
      );
      await target["recordTopDonation"](
        target["formatChargeAlert"](
          makeSucceeded("pi_late", 99_900, inWindow + 7 * 86_400),
        ),
      );

      const top = await target.getTopDonations();
      expect(top?.map((d) => d.amount.cents)).toEqual([700, 500]);
    });

    test("keeps every donation recorded during the first fetch", async () => {
      let finishFetch: () => void = () => {};
      paymentIntentsList.mockReturnValue({
        autoPagingEach: () =>
          new Promise<void>((resolve) => {
            finishFetch = () => resolve();
          }),
      });
      const target = new ChargeAlertManager();
      void target.getTopDonations();

      const recorded = Promise.all(
        [700, 900].map((cents) =>
          target["recordTopDonation"](
            target["formatChargeAlert"](makeSucceeded(`pi_${cents}`, cents)),
          ),
        ),
      );
      finishFetch();
      await recorded;

      const top = await target.getTopDonations();
      expect(top?.map((d) => d.amount.cents)).toEqual([900, 700]);
    });

    test("hides the podium after the end of Monday", async () => {
      stubList([makeSucceeded("pi_first", 500)]);
      const target = new ChargeAlertManager();

      setSystemTime(new Date("2026-10-19T23:59:59-07:00"));
      expect(await target.getTopDonations()).toHaveLength(1);

      setSystemTime(new Date("2026-10-20T00:00:00-07:00"));
      expect(await target.getTopDonations()).toBeNull();

      setSystemTime(new Date(inWindow * 1000));
    });
  });
});
