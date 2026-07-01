import { beforeEach, describe, expect, type Mock, mock, test } from "bun:test";
import type Stripe from "stripe";
import { send as sendEmail } from "~/test-utils/resend.mock";

const mockDefaults = {
  customersList: { data: [] as Stripe.Customer[] },
  customersCreate: { id: "cus_new" },
  subscriptionsList: { data: [] as Stripe.Subscription[] },
  subscriptionsUpdate: {},
  subscriptionsCancel: {},
  checkoutSessionsCreate: {
    client_secret: "cs_secret_123",
    id: "cs_1",
  } as Stripe.Checkout.Session,
  portalSessionsCreate: {
    url: "https://billing.stripe.com/portal_1",
  } as Stripe.BillingPortal.Session,
  customersRetrieve: {
    id: "cus_1",
    email: "test@example.com",
    deleted: false,
  },
};

type MockDefaults = typeof mockDefaults;
type MocksType = {
  [Key in keyof MockDefaults]: Mock<() => Promise<MockDefaults[Key]>>;
};

function initMocks() {
  return Object.fromEntries(
    Object.entries(mockDefaults).map(([key, defaultValue]) => [
      key,
      mock(() => Promise.resolve(defaultValue)),
    ]),
  ) as MocksType;
}

const mocks = initMocks();

mock.module("~/services/stripe", () => ({
  default: {
    customers: {
      list: mocks.customersList,
      create: mocks.customersCreate,
      retrieve: mocks.customersRetrieve,
    },
    subscriptions: {
      list: mocks.subscriptionsList,
      update: mocks.subscriptionsUpdate,
      cancel: mocks.subscriptionsCancel,
    },
    checkout: {
      sessions: { create: mocks.checkoutSessionsCreate },
    },
    billingPortal: {
      sessions: { create: mocks.portalSessionsCreate },
    },
  },
}));

function resetMocks() {
  function resetMock<K extends keyof MockDefaults>(key: K) {
    mocks[key].mockReset();
    mocks[key].mockResolvedValue(mockDefaults[key]);
  }

  for (const key of Object.keys(mocks) as (keyof MockDefaults)[]) {
    resetMock(key);
  }

  sendEmail.mockReset();
  sendEmail.mockResolvedValue({
    data: { id: "email_mock" },
    error: null,
    headers: null,
  });
}

const subscriptionManager = await import("./subscription");

function makeCustomer(
  overrides: Partial<Stripe.Customer> = {},
): Stripe.Customer {
  return {
    id: "cus_1",
    object: "customer",
    email: "test@example.com",
    ...overrides,
  } as Stripe.Customer;
}

function makeSubscription(
  overrides: Partial<Stripe.Subscription> = {},
): Stripe.Subscription {
  return {
    id: "sub_1",
    object: "subscription",
    status: "active",
    customer: "cus_1",
    items: {
      data: [
        {
          id: "si_1",
          price: { unit_amount: 1000 },
        },
      ],
    },
    ...overrides,
  } as Stripe.Subscription;
}

describe("subscription", () => {
  beforeEach(() => {
    resetMocks();
  });

  describe("get", () => {
    test("returns empty when no customer found", async () => {
      mocks.customersList.mockResolvedValue({ data: [] });

      const result = await subscriptionManager.get("nobody@example.com");

      expect(result.customer).toBeUndefined();
      expect(result.subscription).toBeUndefined();
    });

    test("returns customer without subscription", async () => {
      const customer = makeCustomer();
      mocks.customersList.mockResolvedValue({ data: [customer] });
      mocks.subscriptionsList.mockResolvedValue({ data: [] });

      const result = await subscriptionManager.get("test@example.com");

      expect(result.customer).toEqual(customer);
      expect(result.subscription).toBeUndefined();
    });

    test("returns customer with active subscription", async () => {
      const customer = makeCustomer();
      const subscription = makeSubscription();
      mocks.customersList.mockResolvedValue({ data: [customer] });
      // First call returns active subs, second returns past_due subs
      mocks.subscriptionsList
        .mockResolvedValueOnce({ data: [subscription] })
        .mockResolvedValueOnce({ data: [] });

      const result = await subscriptionManager.get("test@example.com");

      expect(result.customer).toEqual(customer);
      expect(result.subscription).toEqual(subscription);
    });

    test("throws when multiple customers found", async () => {
      mocks.customersList.mockResolvedValue({
        data: [makeCustomer({ id: "cus_1" }), makeCustomer({ id: "cus_2" })],
      });

      expect(subscriptionManager.get("test@example.com")).rejects.toThrow(
        "Multiple customers found",
      );
    });

    test("throws when multiple subscriptions found", async () => {
      mocks.customersList.mockResolvedValue({ data: [makeCustomer()] });
      mocks.subscriptionsList
        .mockResolvedValueOnce({ data: [makeSubscription({ id: "sub_1" })] })
        .mockResolvedValueOnce({ data: [makeSubscription({ id: "sub_2" })] });

      expect(subscriptionManager.get("test@example.com")).rejects.toThrow(
        "Multiple active subscriptions found",
      );
    });
  });

  describe("subscribe", () => {
    test("rejects amount below minimum", async () => {
      const result = await subscriptionManager.subscribe("test@example.com", {
        cents: 100,
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe("InvalidMonthlyDonationAmount");
      }
    });

    test("creates embedded checkout session for new customer", async () => {
      mocks.customersList.mockResolvedValue({ data: [] });
      mocks.customersCreate.mockResolvedValue({ id: "cus_new" });

      const result = await subscriptionManager.subscribe("new@example.com", {
        cents: 1000,
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.clientSecret).toBe("cs_secret_123");
      }
      expect(mocks.customersCreate).toHaveBeenCalledWith({
        email: "new@example.com",
      });
    });

    test("creates subscription with client secret for existing customer without subscription", async () => {
      const customer = makeCustomer();
      mocks.customersList.mockResolvedValue({ data: [customer] });
      mocks.subscriptionsList.mockResolvedValue({ data: [] });

      const result = await subscriptionManager.subscribe("test@example.com", {
        cents: 1000,
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.clientSecret).toBeDefined();
      }
      expect(mocks.customersCreate).not.toHaveBeenCalled();
    });

    test("updates existing subscription with different amount", async () => {
      const customer = makeCustomer();
      const subscription = makeSubscription();
      mocks.customersList.mockResolvedValue({ data: [customer] });
      mocks.subscriptionsList
        .mockResolvedValueOnce({ data: [subscription] })
        .mockResolvedValueOnce({ data: [] });

      const result = await subscriptionManager.subscribe("test@example.com", {
        cents: 2000,
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.clientSecret).toBeUndefined();
      }
      expect(mocks.subscriptionsUpdate).toHaveBeenCalled();
    });

    test("rejects update with same amount", async () => {
      const customer = makeCustomer();
      const subscription = makeSubscription(); // has unit_amount: 1000
      mocks.customersList.mockResolvedValue({ data: [customer] });
      mocks.subscriptionsList
        .mockResolvedValueOnce({ data: [subscription] })
        .mockResolvedValueOnce({ data: [] });

      const result = await subscriptionManager.subscribe("test@example.com", {
        cents: 1000,
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe("SameAmount");
      }
    });

    test("rejects update when subscription is past_due", async () => {
      const customer = makeCustomer();
      const subscription = makeSubscription({ status: "past_due" });
      mocks.customersList.mockResolvedValue({ data: [customer] });
      mocks.subscriptionsList
        .mockResolvedValueOnce({ data: [] })
        .mockResolvedValueOnce({ data: [subscription] });

      const result = await subscriptionManager.subscribe("test@example.com", {
        cents: 2000,
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe("PastDue");
      }
    });

    test("returns error when Stripe update throws", async () => {
      const customer = makeCustomer();
      const subscription = makeSubscription();
      mocks.customersList.mockResolvedValue({ data: [customer] });
      mocks.subscriptionsList
        .mockResolvedValueOnce({ data: [subscription] })
        .mockResolvedValueOnce({ data: [] });
      mocks.subscriptionsUpdate.mockRejectedValue(new Error("Stripe error"));

      const result = await subscriptionManager.subscribe("test@example.com", {
        cents: 2000,
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe("UpdateError");
      }
    });

    test("returns error when checkout session has no client secret", async () => {
      mocks.customersList.mockResolvedValue({ data: [] });
      mocks.customersCreate.mockResolvedValue({ id: "cus_new" });
      mocks.checkoutSessionsCreate.mockResolvedValue({
        client_secret: null,
        id: "cs_1",
      } as unknown as Stripe.Checkout.Session);

      const result = await subscriptionManager.subscribe("new@example.com", {
        cents: 1000,
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe("CreateError");
      }
    });
  });

  describe("cancel", () => {
    test("cancels subscription and sends email", async () => {
      const customer = makeCustomer();
      const subscription = makeSubscription();
      mocks.customersList.mockResolvedValue({ data: [customer] });
      mocks.subscriptionsList
        .mockResolvedValueOnce({ data: [subscription] })
        .mockResolvedValueOnce({ data: [] });

      const result = await subscriptionManager.cancel("test@example.com");

      expect(result.success).toBe(true);
      expect(mocks.subscriptionsCancel).toHaveBeenCalledWith("sub_1");
      expect(sendEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: "test@example.com",
        }),
      );
    });

    test("returns error when no customer", async () => {
      mocks.customersList.mockResolvedValue({ data: [] });

      const result = await subscriptionManager.cancel("nobody@example.com");

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe("NoCustomer");
      }
    });

    test("returns error when no subscription", async () => {
      mocks.customersList.mockResolvedValue({ data: [makeCustomer()] });
      mocks.subscriptionsList.mockResolvedValue({ data: [] });

      const result = await subscriptionManager.cancel("test@example.com");

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe("NoSubscription");
      }
    });

    test("returns error when Stripe cancel throws", async () => {
      const customer = makeCustomer();
      const subscription = makeSubscription();
      mocks.customersList.mockResolvedValue({ data: [customer] });
      mocks.subscriptionsList
        .mockResolvedValueOnce({ data: [subscription] })
        .mockResolvedValueOnce({ data: [] });
      mocks.subscriptionsCancel.mockRejectedValue(new Error("Stripe error"));

      const result = await subscriptionManager.cancel("test@example.com");

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe("CancelError");
      }
    });

    test("still succeeds when cancel email fails", async () => {
      const customer = makeCustomer();
      const subscription = makeSubscription();
      mocks.customersList.mockResolvedValue({ data: [customer] });
      mocks.subscriptionsList
        .mockResolvedValueOnce({ data: [subscription] })
        .mockResolvedValueOnce({ data: [] });
      sendEmail.mockResolvedValue({
        data: null,
        error: {
          message: "Email service down",
          statusCode: null,
          name: "internal_server_error",
        },
        headers: null,
      });

      const result = await subscriptionManager.cancel("test@example.com");

      expect(result.success).toBe(true);
    });
  });

  describe("createPortalSession", () => {
    test("returns portal URL", async () => {
      const customer = makeCustomer();
      const subscription = makeSubscription();
      mocks.customersList.mockResolvedValue({ data: [customer] });
      mocks.subscriptionsList
        .mockResolvedValueOnce({ data: [subscription] })
        .mockResolvedValueOnce({ data: [] });

      const result =
        await subscriptionManager.createPortalSession("test@example.com");

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.portalUrl).toBe("https://billing.stripe.com/portal_1");
      }
    });

    test("returns error when no customer", async () => {
      mocks.customersList.mockResolvedValue({ data: [] });

      const result =
        await subscriptionManager.createPortalSession("nobody@example.com");

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe("NoCustomer");
      }
    });

    test("returns error when no subscription", async () => {
      mocks.customersList.mockResolvedValue({ data: [makeCustomer()] });
      mocks.subscriptionsList.mockResolvedValue({ data: [] });

      const result =
        await subscriptionManager.createPortalSession("test@example.com");

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe("NoSubscription");
      }
    });

    test("returns error when portal session creation throws", async () => {
      const customer = makeCustomer();
      const subscription = makeSubscription();
      mocks.customersList.mockResolvedValue({ data: [customer] });
      mocks.subscriptionsList
        .mockResolvedValueOnce({ data: [subscription] })
        .mockResolvedValueOnce({ data: [] });
      mocks.portalSessionsCreate.mockRejectedValue(new Error("Stripe error"));

      const result =
        await subscriptionManager.createPortalSession("test@example.com");

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe("PortalError");
      }
    });

    test("returns error when portal session has no URL", async () => {
      const customer = makeCustomer();
      const subscription = makeSubscription();
      mocks.customersList.mockResolvedValue({ data: [customer] });
      mocks.subscriptionsList
        .mockResolvedValueOnce({ data: [subscription] })
        .mockResolvedValueOnce({ data: [] });
      mocks.portalSessionsCreate.mockResolvedValue({
        url: "",
      } as Stripe.BillingPortal.Session);

      const result =
        await subscriptionManager.createPortalSession("test@example.com");

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe("PortalError");
      }
    });
  });

  describe("processWebhook", () => {
    test("sends welcome email on subscription_create invoice", async () => {
      await subscriptionManager.handleInvoicePaid({
        type: "invoice.paid",
        data: {
          object: {
            billing_reason: "subscription_create",
            customer_email: "test@example.com",
            amount_paid: 1500,
          },
        },
      } as unknown as Stripe.InvoicePaidEvent);

      expect(sendEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: "test@example.com",
        }),
      );
    });

    test("ignores non-subscription_create invoices", async () => {
      await subscriptionManager.handleInvoicePaid({
        type: "invoice.paid",
        data: {
          object: {
            billing_reason: "subscription_cycle",
            customer_email: "test@example.com",
            amount_paid: 1500,
          },
        },
      } as unknown as Stripe.InvoicePaidEvent);

      expect(sendEmail).not.toHaveBeenCalled();
    });

    test("sends past due email when subscription changes to past_due", async () => {
      mocks.customersRetrieve.mockResolvedValue({
        id: "cus_1",
        email: "test@example.com",
        deleted: false,
      });

      await subscriptionManager.handleSubscriptionUpdated({
        type: "customer.subscription.updated",
        data: {
          object: {
            status: "past_due",
            customer: "cus_1",
            items: { data: [{ price: { unit_amount: 1000 } }] },
          },
          previous_attributes: {
            status: "active",
          },
        },
      } as unknown as Stripe.CustomerSubscriptionUpdatedEvent);

      expect(sendEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: "test@example.com",
        }),
      );
    });

    test("sends updated email when subscription amount changes", async () => {
      mocks.customersRetrieve.mockResolvedValue({
        id: "cus_1",
        email: "test@example.com",
        deleted: false,
      });

      await subscriptionManager.handleSubscriptionUpdated({
        type: "customer.subscription.updated",
        data: {
          object: {
            status: "active",
            customer: "cus_1",
            items: { data: [{ price: { unit_amount: 2000 } }] },
          },
          previous_attributes: {
            status: "active",
            items: { data: [{ price: { unit_amount: 1000 } }] },
          },
        },
      } as unknown as Stripe.CustomerSubscriptionUpdatedEvent);

      expect(sendEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: "test@example.com",
        }),
      );
    });

    test("does not send email for unrelated subscription update", async () => {
      mocks.customersRetrieve.mockResolvedValue({
        id: "cus_1",
        email: "test@example.com",
        deleted: false,
      });

      await subscriptionManager.handleSubscriptionUpdated({
        type: "customer.subscription.updated",
        data: {
          object: {
            status: "active",
            customer: "cus_1",
            items: { data: [{ price: { unit_amount: 1000 } }] },
          },
          previous_attributes: {
            status: "active",
            items: { data: [{ price: { unit_amount: 1000 } }] },
          },
        },
      } as unknown as Stripe.CustomerSubscriptionUpdatedEvent);

      expect(sendEmail).not.toHaveBeenCalled();
    });

    test("does not send past due email when subscription was already past_due", async () => {
      mocks.customersRetrieve.mockResolvedValue({
        id: "cus_1",
        email: "test@example.com",
        deleted: false,
      });

      await subscriptionManager.handleSubscriptionUpdated({
        type: "customer.subscription.updated",
        data: {
          object: {
            status: "past_due",
            customer: "cus_1",
            items: { data: [{ price: { unit_amount: 1000 } }] },
          },
          previous_attributes: {
            status: "past_due",
          },
        },
      } as unknown as Stripe.CustomerSubscriptionUpdatedEvent);

      expect(sendEmail).not.toHaveBeenCalled();
    });

    test("skips email for deleted customer", async () => {
      mocks.customersRetrieve.mockResolvedValue({
        id: "cus_1",
        email: "",
        deleted: true,
      });

      await subscriptionManager.handleSubscriptionUpdated({
        type: "customer.subscription.updated",
        data: {
          object: {
            status: "past_due",
            customer: "cus_1",
            items: { data: [{ price: { unit_amount: 1000 } }] },
          },
          previous_attributes: { status: "active" },
        },
      } as unknown as Stripe.CustomerSubscriptionUpdatedEvent);

      expect(sendEmail).not.toHaveBeenCalled();
    });
  });
});
