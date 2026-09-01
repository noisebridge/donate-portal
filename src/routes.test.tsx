import {
  afterAll,
  beforeEach,
  describe,
  expect,
  type Mock,
  mock,
  test,
} from "bun:test";
import fastifyCookie, { sign } from "@fastify/cookie";
import fastifyCsrf from "@fastify/csrf-protection";
import fastifyFormbody from "@fastify/formbody";
import fastifyWebsocket from "@fastify/websocket";
import html from "@kitajs/fastify-html-plugin";
import Fastify, { type FastifyInstance } from "fastify";
import type { Response as InjectResponse } from "light-my-request";
import Stripe from "stripe";
import config from "~/config";
import assets from "~/lib/assets";
import contentSecurityPolicy from "~/lib/content-security-policy";
import permissionsPolicy from "~/lib/permissions-policy";
import { CookieName, type SessionData } from "~/lib/signed-cookies";
import { createMockSubscription } from "~/test-utils/mock-subscription";

const WEBHOOK_SECRET = "whsec_routes_test";

// Signature verification is pure local HMAC, so a real Stripe client can both
// sign and verify webhook payloads without touching the network.
const realStripe = new Stripe("sk_test_routes");

const mockDefaults = {
  paymentIntentsCreate: {
    client_secret: "pi_secret_123",
  } as Stripe.PaymentIntent,
  paymentIntentsList: { data: [] as Stripe.PaymentIntent[] },
  customersList: { data: [] as Stripe.Customer[] },
  customersCreate: { id: "cus_new" },
  customersRetrieve: { id: "cus_1", email: "test@example.com", deleted: false },
  subscriptionsList: { data: [] as Stripe.Subscription[] },
  subscriptionsUpdate: {},
  subscriptionsCancel: {},
  checkoutSessionsCreate: {
    client_secret: "cs_secret_123",
  } as Stripe.Checkout.Session,
  portalSessionsCreate: {
    url: "https://billing.stripe.com/portal_1",
  } as Stripe.BillingPortal.Session,
};

type MockDefaults = typeof mockDefaults;
type MocksType = {
  [Key in keyof MockDefaults]: Mock<() => Promise<MockDefaults[Key]>>;
};

const mocks = Object.fromEntries(
  Object.entries(mockDefaults).map(([key, defaultValue]) => [
    key,
    mock(() => Promise.resolve(defaultValue)),
  ]),
) as MocksType;

mock.module("~/services/stripe", () => ({
  default: {
    paymentIntents: {
      create: mocks.paymentIntentsCreate,
      list: mocks.paymentIntentsList,
    },
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
    checkout: { sessions: { create: mocks.checkoutSessionsCreate } },
    billingPortal: { sessions: { create: mocks.portalSessionsCreate } },
    webhooks: realStripe.webhooks,
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
}

const { default: routes, maxRawBodyBytes } = await import("./routes");

/**
 * Mirrors the plugin wiring in `src/server.ts`, minus the `listen()` call, so
 * routes can be exercised through `inject()`.
 */
async function buildApp(): Promise<FastifyInstance> {
  const app = Fastify({ logger: false, bodyLimit: maxRawBodyBytes });

  await app.register(fastifyCookie, { secret: config.cookieSecret });
  await app.register(fastifyCsrf, { sessionPlugin: "@fastify/cookie" });
  await app.register(contentSecurityPolicy);
  await app.register(permissionsPolicy);
  await app.register(fastifyFormbody);
  app.addContentTypeParser(
    "application/csp-report",
    { parseAs: "string" },
    app.getDefaultJsonParser("ignore", "ignore"),
  );
  await app.register(assets);
  await app.register(fastifyWebsocket);
  await app.register(html);
  // Test-only route so tests can mint a CSRF token/cookie pair from the same
  // instance the real routes validate against.
  app.get("/__csrf", async (_request, reply) =>
    reply.send({ token: reply.generateCsrf() }),
  );
  await app.register(routes);
  await app.ready();

  return app;
}

const app = await buildApp();
afterAll(() => app.close());

/** `inject()` responses are untyped, so narrow the JSON body for assertions. */
function json(response: InjectResponse): Record<string, unknown> {
  return response.json();
}

function sessionCookie(email = "test@example.com"): string {
  const data: SessionData = {
    email,
    provider: "magic_link",
    issued: Date.now(),
  };
  return `${CookieName.UserSession}=${sign(JSON.stringify(data), config.cookieSecret)}`;
}

/** Mint a matching CSRF token and `_csrf` cookie. */
async function csrf(): Promise<{ token: string; cookie: string }> {
  const response = await app.inject({ method: "GET", url: "/__csrf" });
  const setCookie = response.headers["set-cookie"];
  const raw = Array.isArray(setCookie) ? setCookie[0] : setCookie;

  return {
    token: String(json(response)["token"]),
    cookie: raw?.split(";")[0] ?? "",
  };
}

/** POST a urlencoded form with a valid CSRF token. */
async function postForm(
  url: string,
  body: Record<string, string>,
  extraCookies: string[] = [],
) {
  const { token, cookie } = await csrf();

  return await app.inject({
    method: "POST",
    url,
    headers: {
      "content-type": "application/x-www-form-urlencoded",
      cookie: [cookie, ...extraCookies].join("; "),
    },
    payload: new URLSearchParams({ ...body, _csrf: token }).toString(),
  });
}

async function webhookRequest(event: object) {
  const payload = JSON.stringify(event);

  return await app.inject({
    method: "POST",
    url: "/webhook",
    headers: {
      "content-type": "application/json",
      "stripe-signature":
        await realStripe.webhooks.generateTestHeaderStringAsync({
          payload,
          secret: WEBHOOK_SECRET,
        }),
    },
    payload,
  });
}

const originalWebhookSecret = config.stripeWebhookSecret;

beforeEach(() => {
  resetMocks();
  config.stripeWebhookSecret = WEBHOOK_SECRET;
});

afterAll(() => {
  config.stripeWebhookSecret = originalWebhookSecret;
});

describe("routes", () => {
  describe("GET /healthz", () => {
    test("reports ok", async () => {
      const response = await app.inject({ method: "GET", url: "/healthz" });

      expect(response.statusCode).toBe(200);
      expect(json(response)).toEqual({ status: "ok" });
    });
  });

  describe("security headers", () => {
    test("sets CSP and Permissions-Policy on HTML responses", async () => {
      const response = await app.inject({ method: "GET", url: "/" });

      expect(response.headers["content-security-policy"]).toContain(
        "default-src",
      );
      expect(response.headers["permissions-policy"]).toContain("payment=");
    });

    test("leaves non-HTML responses alone", async () => {
      const response = await app.inject({ method: "GET", url: "/healthz" });

      expect(response.headers["content-security-policy"]).toBeUndefined();
      expect(response.headers["permissions-policy"]).toBeUndefined();
    });
  });

  describe("static assets", () => {
    test("serves a stylesheet from /assets", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/assets/css/main.css",
      });

      expect(response.statusCode).toBe(200);
      expect(response.headers["content-type"]).toContain("text/css");
    });
  });

  describe("GET /", () => {
    test("renders a known error code from the query string", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/?error=InvalidDonationAmount",
      });

      expect(response.body).toContain("Please select a valid donation amount");
    });

    test("ignores an unknown error code", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/?error=NotARealCode&info=AlsoNotReal",
      });

      expect(response.statusCode).toBe(200);
      expect(response.body).not.toContain("NotARealCode");
    });
  });

  describe("not found handler", () => {
    test("renders the 404 page", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/no-such-page",
      });

      expect(response.statusCode).toBe(404);
      expect(response.body).toContain("<!DOCTYPE html>");
    });
  });

  describe("error handler", () => {
    test("renders a 500 page when a handler throws", async () => {
      mocks.paymentIntentsCreate.mockRejectedValue(new Error("stripe is down"));

      const response = await postForm("/donate", { "amount-dollars": "10" });

      expect(response.statusCode).toBe(500);
      expect(response.body).toContain("fatal_error");
    });

    test("renders a 4xx page for a CSRF failure without a token", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/donate",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        payload: "amount-dollars=10",
      });

      expect(response.statusCode).toBe(403);
      expect(response.body).toContain("fatal_error");
    });
  });

  describe("GET /auth", () => {
    test("renders the sign-in page when unauthenticated", async () => {
      const response = await app.inject({ method: "GET", url: "/auth" });

      expect(response.statusCode).toBe(200);
      expect(response.headers["set-cookie"]).toBeDefined();
    });

    test("redirects to /manage when already authenticated", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/auth",
        headers: { cookie: sessionCookie() },
      });

      expect(response.statusCode).toBe(302);
      expect(response.headers.location).toBe("/manage");
    });
  });

  describe("GET /qr", () => {
    test("redirects to the index for an unparseable amount", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/qr?amount=banana",
      });

      expect(response.statusCode).toBe(302);
      expect(response.headers.location).toBe("/?error=InvalidDonationAmount");
    });

    test("rejects an over-long name", async () => {
      const response = await app.inject({
        method: "GET",
        url: `/qr?amount=5&name=${"a".repeat(100)}`,
      });

      expect(response.statusCode).toBe(400);
    });
  });

  describe("GET /qr.svg", () => {
    test("returns an SVG for a valid amount", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/qr.svg?amount=5",
      });

      expect(response.statusCode).toBe(200);
      expect(response.headers["content-type"]).toContain("image/svg+xml");
      expect(response.body).toContain("<svg");
    });

    test("returns a different SVG when the logo is disabled", async () => {
      const withLogo = await app.inject({
        method: "GET",
        url: "/qr.svg?amount=5",
      });
      const withoutLogo = await app.inject({
        method: "GET",
        url: "/qr.svg?amount=5&use-logo=false",
      });

      expect(withoutLogo.statusCode).toBe(200);
      expect(withoutLogo.body).not.toBe(withLogo.body);
    });

    test("rejects a missing amount", async () => {
      const response = await app.inject({ method: "GET", url: "/qr.svg" });

      expect(response.statusCode).toBe(400);
    });

    test("rejects an over-long description", async () => {
      const response = await app.inject({
        method: "GET",
        url: `/qr.svg?amount=5&description=${"a".repeat(200)}`,
      });

      expect(response.statusCode).toBe(400);
    });
  });

  describe("POST /donate", () => {
    test("returns a client secret for a valid amount", async () => {
      const response = await postForm("/donate", { "amount-dollars": "10" });

      expect(json(response)).toEqual({
        clientSecret: "pi_secret_123",
        emailAddress: null,
      });
    });

    test("includes the session email when authenticated", async () => {
      const response = await postForm("/donate", { "amount-dollars": "10" }, [
        sessionCookie("donor@example.com"),
      ]);

      expect(json(response)["emailAddress"]).toBe("donor@example.com");
    });

    test("redirects when the form data is not a valid amount form", async () => {
      const response = await postForm("/donate", { nonsense: "1" });

      expect(json(response)).toEqual({ redirect: "/?error=InvalidRequest" });
    });

    test("redirects when the amount cannot be parsed", async () => {
      const response = await postForm("/donate", { "amount-dollars": "0" });

      expect(json(response)).toEqual({
        redirect: "/?error=InvalidDonationAmount",
      });
    });

    test("redirects when the name is too long", async () => {
      const response = await postForm("/donate", {
        "amount-dollars": "10",
        name: "a".repeat(100),
      });

      expect(json(response)).toEqual({ redirect: "/?error=InvalidRequest" });
    });

    test("redirects when the donation manager rejects the amount", async () => {
      const response = await postForm("/donate", { "amount-dollars": "0.01" });

      expect(json(response)).toEqual({
        redirect: "/?error=InvalidDonationAmount",
      });
    });
  });

  describe("GET /manage", () => {
    test("redirects to the index without a session", async () => {
      const response = await app.inject({ method: "GET", url: "/manage" });

      expect(response.statusCode).toBe(302);
      expect(response.headers.location).toBe("/");
    });

    test("renders the manage page for a session with no subscription", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/manage",
        headers: { cookie: sessionCookie() },
      });

      expect(response.statusCode).toBe(200);
      expect(response.headers["cache-control"]).toBe("no-store");
    });

    test("shows a past-due banner when the subscription is past due", async () => {
      const subscription = createMockSubscription();
      subscription.status = "past_due";
      mocks.customersList.mockResolvedValue({
        data: [{ id: "cus_1" } as Stripe.Customer],
      });
      mocks.subscriptionsList.mockResolvedValueOnce({ data: [] });
      mocks.subscriptionsList.mockResolvedValueOnce({ data: [subscription] });

      const response = await app.inject({
        method: "GET",
        url: "/manage",
        headers: { cookie: sessionCookie() },
      });

      expect(response.body).toContain("past due");
    });
  });

  describe("POST /subscribe", () => {
    test("redirects unauthenticated callers to sign in", async () => {
      const response = await postForm("/subscribe", { "amount-dollars": "10" });

      expect(json(response)).toEqual({ redirect: "/auth" });
    });

    test("returns a client secret for a new subscription", async () => {
      const response = await postForm(
        "/subscribe",
        { "amount-dollars": "10" },
        [sessionCookie()],
      );

      expect(json(response)).toEqual({
        clientSecret: "cs_secret_123",
        emailAddress: "test@example.com",
      });
    });

    test("redirects when the form data is not a valid amount form", async () => {
      const response = await postForm("/subscribe", { nonsense: "1" }, [
        sessionCookie(),
      ]);

      expect(json(response)).toEqual({
        redirect: "/manage?error=InvalidRequest",
      });
    });

    test("redirects when the amount cannot be parsed", async () => {
      const response = await postForm("/subscribe", { "amount-dollars": "0" }, [
        sessionCookie(),
      ]);

      expect(json(response)).toEqual({
        redirect: "/manage?error=InvalidMonthlyDonationAmount",
      });
    });

    test("redirects with the manager error when subscribing fails", async () => {
      const response = await postForm("/subscribe", { "amount-dollars": "1" }, [
        sessionCookie(),
      ]);

      expect(json(response)).toEqual({
        redirect: "/manage?error=InvalidMonthlyDonationAmount",
      });
    });

    test("redirects with an info message when an existing subscription is updated", async () => {
      mocks.customersList.mockResolvedValue({
        data: [{ id: "cus_1" } as Stripe.Customer],
      });
      mocks.subscriptionsList.mockResolvedValueOnce({
        data: [createMockSubscription({ unitAmount: 5000 })],
      });

      const response = await postForm(
        "/subscribe",
        { "amount-dollars": "99" },
        [sessionCookie()],
      );

      expect(json(response)).toEqual({
        redirect: "/manage?info=SubscriptionUpdated",
      });
    });
  });

  describe("POST /subscribe/portal", () => {
    test("redirects unauthenticated callers to sign in", async () => {
      const response = await postForm("/subscribe/portal", {});

      expect(response.statusCode).toBe(302);
      expect(response.headers.location).toBe("/auth");
    });

    test("redirects to the Stripe portal URL", async () => {
      mocks.customersList.mockResolvedValue({
        data: [{ id: "cus_1" } as Stripe.Customer],
      });
      mocks.subscriptionsList.mockResolvedValueOnce({
        data: [createMockSubscription()],
      });

      const response = await postForm("/subscribe/portal", {}, [
        sessionCookie(),
      ]);

      expect(response.headers.location).toBe(
        "https://billing.stripe.com/portal_1",
      );
    });

    test("redirects back to /manage with an error when there is no customer", async () => {
      const response = await postForm("/subscribe/portal", {}, [
        sessionCookie(),
      ]);

      expect(response.headers.location).toBe("/manage?error=NoCustomer");
    });
  });

  describe("POST /cancel", () => {
    test("redirects unauthenticated callers to sign in", async () => {
      const response = await postForm("/cancel", {});

      expect(response.statusCode).toBe(302);
      expect(response.headers.location).toBe("/auth");
    });

    test("cancels an active subscription", async () => {
      mocks.customersList.mockResolvedValue({
        data: [{ id: "cus_1" } as Stripe.Customer],
      });
      mocks.subscriptionsList.mockResolvedValueOnce({
        data: [createMockSubscription()],
      });

      const response = await postForm("/cancel", {}, [sessionCookie()]);

      expect(response.headers.location).toBe(
        "/manage?info=SubscriptionCancelled",
      );
    });

    test("redirects with an error when there is nothing to cancel", async () => {
      const response = await postForm("/cancel", {}, [sessionCookie()]);

      expect(response.headers.location).toBe("/manage?error=NoCustomer");
    });
  });

  describe("POST /auth/signout", () => {
    test("clears the session cookie and redirects home", async () => {
      const response = await postForm("/auth/signout", {}, [sessionCookie()]);

      expect(response.statusCode).toBe(302);
      expect(response.headers.location).toBe("/");
      expect(String(response.headers["set-cookie"])).toContain(
        CookieName.UserSession,
      );
    });
  });
});
