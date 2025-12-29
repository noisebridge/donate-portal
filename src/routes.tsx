import crypto from "node:crypto";
import stream from "node:stream";
import type {
  FastifyInstance,
  FastifyReply,
  FastifyRequest,
  RouteShorthandOptions,
} from "fastify";
import type Stripe from "stripe";
import type { Message } from "~/components/message-container";
import config from "~/config";
import donationManager from "~/managers/donation";
import magicLinkManager from "~/managers/magic-link";
import subscriptionManager from "~/managers/subscription";
import { parseToCents, validateAmountFormData } from "~/money";
import githubOAuth from "~/services/github";
import googleOAuth from "~/services/google";
import stripe from "~/services/stripe";
import { CookieName, cookies } from "~/signed-cookies";
import { AuthPage } from "~/views/auth";
import { AuthEmailPage } from "~/views/auth/email";
import { ErrorPage } from "~/views/error";
import { IndexPage } from "~/views/index";
import { ManagePage } from "~/views/manage";
import { NotFoundPage } from "~/views/not-found";
import { ThankYouPage } from "~/views/thank-you";
import emailManager from "./managers/email";

const authRateLimit: RouteShorthandOptions = {
  config: {
    rateLimit: {
      max: 3,
      timeWindow: "1 minute",
    },
  },
} as const;

/**
 * Cryptographically secure random string for use with OAuth.
 */
export function getRandomState() {
  return crypto.randomBytes(32).toString("hex");
}

type NotificationParams = Partial<Record<Message["type"], string>>;

/**
 * Format a page path with query params.
 */
function formatPath(path: string, params?: Record<string, string>) {
  if (!params || Object.keys(params).length === 0) {
    return path;
  }

  const urlSearchParams = new URLSearchParams(params);
  return `${path}?${urlSearchParams}`;
}

const paths = {
  index: (params?: NotificationParams) => formatPath("/", params),
  signIn: (params?: NotificationParams) => formatPath("/auth", params),
  waitForEmail: (email: string) => formatPath("/auth/email", { email }),
  signOut: "/auth/signout",
  githubStart: "/auth/github/start",
  googleStart: "/auth/google/start",
  manage: (params?: NotificationParams) => formatPath("/manage", params),
} as const;

export enum ErrorCode {
  InvalidState = "Invalid OAuth state parameter",
  InvalidRequest = "Invalid request parameters",
  GithubError = "GitHub raised an error",
  GoogleError = "Google raised an error",
  NoEmail = "Could not find an email address for you",
  EmailInvalid = "Invalid email address",
  InvalidMagicLink = "Invalid magic link",
  MagicLinkExpired = "Magic link has expired. Please request a new one.",
  InvalidDonationAmount = "Please select a valid donation amount",
  InvalidMonthlyDonationAmount = "Please select a valid donation amount",
  PastDue = "Your subscription is past due! Click the Payment Methods button to fix it.",
}

export enum InfoCode {
  SubscriptionCreated = "Your monthly donation has been set up. Thank you!",
  SubscriptionUpdated = "Your donation amount has been updated.",
  SubscriptionCancelled = "Your monthly donation has been cancelled.",
}

function isAuthenticated(
  request: FastifyRequest,
  reply: FastifyReply,
): boolean {
  return cookies[CookieName.UserSession](request, reply).valid();
}

/**
 * Fastify preParsing hook to capture raw request body for webhook signature verification.
 */
async function rawBody(
  request: FastifyRequest,
  _reply: FastifyReply,
  payload: stream.Readable,
): Promise<stream.Readable> {
  const chunks: Buffer[] = [];
  for await (const chunk of payload) {
    if (!Buffer.isBuffer(chunk)) {
      throw new Error("Expected chunk to be a Buffer");
    }

    chunks.push(chunk);
  }

  request.rawBody = Buffer.concat(chunks);

  return stream.Readable.from([request.rawBody]);
}

export default async function routes(fastify: FastifyInstance) {
  fastify.setErrorHandler(
    (error: unknown, request: FastifyRequest, reply: FastifyReply) => {
      fastify.log.error(
        {
          err: error,
          url: request.url,
          method: request.method,
        },
        "Unhandled error in route",
      );

      reply
        .status(500)
        .html(
          <ErrorPage
            isAuthenticated={isAuthenticated(request, reply)}
            error={
              error instanceof Error
                ? error
                : new Error(`Unknown error: ${error}`)
            }
          />,
        );
    },
  );

  fastify.setNotFoundHandler((request: FastifyRequest, reply: FastifyReply) => {
    fastify.log.warn(
      {
        url: request.url,
        method: request.method,
      },
      "Route not found",
    );

    reply
      .status(404)
      .html(<NotFoundPage isAuthenticated={isAuthenticated(request, reply)} />);
  });

  fastify.get<{
    Querystring: NotificationParams;
  }>("/", async (request, reply) => {
    const error = request.query.error;
    const messages: Message[] = [];
    if (error) {
      messages.push({ type: "error", text: error });
    }

    return reply.html(
      <IndexPage
        isAuthenticated={isAuthenticated(request, reply)}
        messages={messages}
      />,
    );
  });

  fastify.get<{
    Querystring: NotificationParams;
  }>("/auth", async (request, reply) => {
    if (isAuthenticated(request, reply)) {
      return reply.redirect(paths.manage());
    }

    const error = request.query.error;
    const messages: Message[] = [];
    if (error) {
      messages.push({ type: "error", text: error });
    }

    return reply.html(
      <AuthPage
        isAuthenticated={isAuthenticated(request, reply)}
        messages={messages}
      />,
    );
  });

  fastify.get("/auth/github/start", authRateLimit, async (request, reply) => {
    if (isAuthenticated(request, reply)) {
      return reply.redirect(paths.manage());
    }

    const state = getRandomState();
    const githubCookie = cookies[CookieName.GithubOAuthState](request, reply);
    githubCookie.value = { state };

    const authUrl = githubOAuth.getAuthorizationUrl(state, ["user:email"]);
    return reply.redirect(authUrl);
  });

  fastify.get<{
    Querystring: { code?: string; state?: string } & NotificationParams;
  }>("/auth/github/callback", async (request, reply) => {
    if (request.query.error) {
      fastify.log.warn({ error: request.query.error }, "GitHub OAuth error");
      return reply.redirect(paths.signIn({ error: ErrorCode.GithubError }));
    }

    const { code, state } = request.query;
    if (!code || !state) {
      fastify.log.warn("Missing code or state parameter in callback");
      return reply.redirect(paths.signIn({ error: ErrorCode.InvalidRequest }));
    }

    const githubCookie = cookies[CookieName.GithubOAuthState](request, reply);
    const cookieValue = githubCookie.value;
    githubCookie.clear();
    if (cookieValue?.state !== state) {
      fastify.log.warn("Invalid or mismatched state parameter");
      return reply.redirect(paths.signIn({ error: ErrorCode.InvalidState }));
    }

    const { user, primaryEmail } = await githubOAuth.completeOAuthFlow(code);
    const email = primaryEmail || user.email;
    if (!email) {
      fastify.log.warn(
        { userId: user.id, login: user.login },
        "No email found for GitHub user",
      );
      return reply.redirect(paths.signIn({ error: ErrorCode.NoEmail }));
    }

    const sessionCookie = cookies[CookieName.UserSession](request, reply);
    sessionCookie.value = { email: email, provider: "github" };

    fastify.log.info(
      { userId: user.id, login: user.login, email },
      "User authenticated via GitHub",
    );

    return reply.redirect(paths.manage());
  });

  fastify.get("/auth/google/start", authRateLimit, async (request, reply) => {
    if (isAuthenticated(request, reply)) {
      return reply.redirect(paths.manage());
    }

    const state = getRandomState();
    const googleCookie = cookies[CookieName.GoogleOAuthState](request, reply);
    googleCookie.value = { state };

    const authUrl = googleOAuth.getAuthorizationUrl(state, [
      "openid",
      "https://www.googleapis.com/auth/userinfo.email",
      "https://www.googleapis.com/auth/userinfo.profile",
    ]);
    return reply.redirect(authUrl);
  });

  fastify.get<{
    Querystring: { code?: string; state?: string } & NotificationParams;
  }>("/auth/google/callback", async (request, reply) => {
    if (request.query.error) {
      fastify.log.warn({ error: request.query.error }, "Google OAuth error");
      return reply.redirect(paths.signIn({ error: ErrorCode.GoogleError }));
    }

    const { code, state } = request.query;
    if (!code || !state) {
      fastify.log.warn("Missing code or state parameter in Google callback");
      return reply.redirect(paths.signIn({ error: ErrorCode.InvalidRequest }));
    }

    const googleCookie = cookies[CookieName.GoogleOAuthState](request, reply);
    const cookieValue = googleCookie.value;
    googleCookie.clear();
    if (cookieValue?.state !== state) {
      fastify.log.warn(
        "Invalid or mismatched state parameter for Google OAuth",
      );
      return reply.redirect(paths.signIn({ error: ErrorCode.InvalidState }));
    }

    const { userInfo } = await googleOAuth.completeOAuthFlow(code);
    if (!userInfo.email || !userInfo.verified_email) {
      fastify.log.warn(
        { userId: userInfo.id },
        "No verified email found for Google user",
      );
      return reply.redirect(paths.signIn({ error: ErrorCode.NoEmail }));
    }

    const sessionCookie = cookies[CookieName.UserSession](request, reply);
    sessionCookie.value = { email: userInfo.email, provider: "google" };

    fastify.log.info(
      { userId: userInfo.id, email: userInfo.email },
      "User authenticated via Google",
    );

    return reply.redirect(paths.manage());
  });

  fastify.post<{
    Body: { email?: string };
  }>("/auth/email", authRateLimit, async (request, reply) => {
    if (isAuthenticated(request, reply)) {
      return reply.redirect(paths.manage());
    }

    const email = request.body?.email?.trim();

    if (!email) {
      fastify.log.warn("Missing email in POST /auth/email");
      return reply.redirect(paths.signIn({ error: ErrorCode.InvalidRequest }));
    }

    // Basic email validation
    if (!email.includes("@") || email.length < 5) {
      fastify.log.warn({ email }, "Invalid email format");
      return reply.redirect(paths.signIn({ error: ErrorCode.EmailInvalid }));
    }

    const response = await emailManager.sendMagicLinkEmail(email);
    request.log.info(response);
    fastify.log.info({ email }, "Magic link email sent");

    return reply.redirect(paths.waitForEmail(email));
  });

  fastify.get<{
    Querystring: { email?: string };
  }>("/auth/email", async (request, reply) => {
    if (isAuthenticated(request, reply)) {
      return reply.redirect(paths.manage());
    }

    const email = request.query.email;
    if (!email) {
      fastify.log.warn("Missing email parameter in /auth/email");
      return reply.redirect(paths.signIn({ error: ErrorCode.InvalidRequest }));
    }

    return reply.html(
      <AuthEmailPage
        email={email}
        isAuthenticated={isAuthenticated(request, reply)}
      />,
    );
  });

  fastify.get<{
    Querystring: { state?: string };
  }>("/auth/magic-link/callback", async (request, reply) => {
    const { state } = request.query;

    if (!state) {
      fastify.log.warn("Missing state parameter in magic link callback");
      return reply.redirect(paths.signIn({ error: ErrorCode.InvalidRequest }));
    }

    const magicLinkState = magicLinkManager.decodeMagicLinkState(state);
    if (!magicLinkState) {
      fastify.log.warn("Invalid state parameter in magic link callback");
      return reply.redirect(
        paths.signIn({ error: ErrorCode.InvalidMagicLink }),
      );
    }

    const { email, code } = magicLinkState;

    const isValid = magicLinkManager.verifyMagicLinkCode(email, code);
    if (!isValid) {
      fastify.log.warn({ email }, "Invalid or expired magic link code");
      return reply.redirect(
        paths.signIn({ error: ErrorCode.MagicLinkExpired }),
      );
    }

    const sessionCookie = cookies[CookieName.UserSession](request, reply);
    sessionCookie.value = { email, provider: "magic_link" };

    fastify.log.info({ email }, "User authenticated via magic link");

    return reply.redirect(paths.manage());
  });

  if (config.testingBackdoor) {
    fastify.get<{
      Querystring: { email?: string };
    }>("/auth/backdoor", async (request, reply) => {
      const { email } = request.query;

      if (!email) {
        fastify.log.warn("Missing email parameter");
        return reply.redirect(
          paths.signIn({ error: ErrorCode.InvalidRequest }),
        );
      }

      const sessionCookie = cookies[CookieName.UserSession](request, reply);
      sessionCookie.value = { email, provider: "magic_link" };

      fastify.log.info({ email }, "User authenticated via backdoor");

      return reply.redirect(paths.manage());
    });
  }

  fastify.get("/auth/signout", async (request, reply) => {
    const sessionCookie = cookies[CookieName.UserSession](request, reply);
    sessionCookie.clear();

    return reply.redirect(paths.index());
  });

  fastify.get<{
    Querystring: NotificationParams;
  }>("/manage", async (request, reply) => {
    const sessionCookie = cookies[CookieName.UserSession](request, reply);
    const sessionData = sessionCookie.value;
    if (!sessionData) {
      fastify.log.debug("No valid session found, redirecting to auth");
      sessionCookie.clear();
      return reply.redirect(paths.index());
    }

    const customerSubscription = await subscriptionManager.getSubscription(
      sessionData.email,
    );

    const { error, info } = request.query;

    const messages: Message[] = [];
    if (error) {
      messages.push({ type: "error", text: error });
    }
    if (customerSubscription.subscription?.status === "past_due") {
      messages.push({ type: "error", text: ErrorCode.PastDue });
    }
    if (info) {
      messages.push({ type: "info", text: info });
    }

    return reply.html(
      <ManagePage
        email={sessionData.email}
        customer={customerSubscription.customer}
        subscription={customerSubscription.subscription}
        messages={messages}
      />,
    );
  });

  fastify.post("/donate", async (request, reply) => {
    const body = request.body;
    if (!validateAmountFormData(body)) {
      return reply.redirect(paths.index({ error: ErrorCode.InvalidRequest }));
    }

    const amountCents = parseToCents(body);
    if (amountCents === null) {
      fastify.log.warn({ body }, "Invalid subscription amount");
      return reply.redirect(
        paths.index({ error: ErrorCode.InvalidMonthlyDonationAmount }),
      );
    }

    const result = await donationManager.donate(amountCents);
    if (!result.success) {
      fastify.log.error(`Couldn't initiate Stripe donation: ${result.error}`);
      return reply.redirect(paths.index({ error: result.error }));
    }

    fastify.log.info(
      { amount: amountCents, sessionId: result.sessionId },
      "Stripe checkout session created for donation",
    );

    return reply.redirect(result.checkoutUrl);
  });

  fastify.get<{
    Querystring: { name?: string; description?: string; amount?: string };
  }>("/qr", async (request, reply) => {
    const { name, description, amount } = request.query;

    const amountCents = parseToCents(amount ?? "");
    if (amountCents === null) {
      return reply.redirect(
        paths.index({ error: ErrorCode.InvalidDonationAmount }),
      );
    }

    const result = await donationManager.donate(amountCents, name, description);
    if (!result.success) {
      fastify.log.error(`Coudn't initiate Stripe donation: ${result.error}`);
      return reply.redirect(paths.index({ error: result.error }));
    }

    fastify.log.info(
      { amount: amountCents, sessionId: result.sessionId },
      "Stripe checkout session created for QR donation",
    );

    return reply.redirect(result.checkoutUrl);
  });

  fastify.get("/subscribe/portal", async (request, reply) => {
    const sessionCookie = cookies[CookieName.UserSession](request, reply);
    const sessionData = sessionCookie.value;
    if (!sessionData) {
      fastify.log.warn("Unauthenticated portal access attempt");
      return reply.redirect(paths.signIn());
    }

    const result = await subscriptionManager.createPortalSession(
      sessionData.email,
    );
    if (!result.success) {
      fastify.log.error(
        { email: sessionData.email, error: result.error },
        "Failed to create billing portal session",
      );
      return reply.redirect(paths.manage({ error: result.error }));
    }

    fastify.log.info(
      { email: sessionData.email },
      "Billing portal session created",
    );

    return reply.redirect(result.portalUrl);
  });

  fastify.post("/subscribe", async (request, reply) => {
    const sessionCookie = cookies[CookieName.UserSession](request, reply);
    const sessionData = sessionCookie.value;
    if (!sessionData) {
      fastify.log.warn("Unauthenticated subscription attempt");
      return reply.redirect(paths.signIn());
    }

    const body = request.body;
    if (!validateAmountFormData(body)) {
      return reply.redirect(paths.manage({ error: ErrorCode.InvalidRequest }));
    }

    const amountCents = parseToCents(body);
    if (amountCents === null) {
      fastify.log.warn(
        { body, email: sessionData.email },
        "Invalid subscription amount",
      );
      return reply.redirect(
        paths.manage({ error: ErrorCode.InvalidMonthlyDonationAmount }),
      );
    }

    const result = await subscriptionManager.subscribe(
      sessionData.email,
      amountCents,
    );
    if (!result.success) {
      return reply.redirect(paths.manage({ error: result.error }));
    }
    if (!result.checkoutUrl) {
      // If a subscription is updated there is no checkout process
      return reply.redirect(
        paths.manage({ info: InfoCode.SubscriptionUpdated }),
      );
    }

    fastify.log.info(
      {
        amount: amountCents,
        email: sessionData.email,
      },
      "Stripe subscription checkout session created",
    );

    return reply.redirect(result.checkoutUrl);
  });

  fastify.post("/cancel", async (request, reply) => {
    const sessionCookie = cookies[CookieName.UserSession](request, reply);
    const sessionData = sessionCookie.value;
    if (!sessionData) {
      fastify.log.warn("Unauthenticated cancel attempt");
      return reply.redirect(paths.signIn());
    }

    const result = await subscriptionManager.cancel(sessionData.email);

    if (!result.success) {
      fastify.log.warn(
        { email: sessionData.email, error: result.error },
        "Cancel request failed",
      );
      return reply.redirect(paths.manage({ error: result.error }));
    }

    fastify.log.info({ email: sessionData.email }, "Subscription canceled");

    return reply.redirect(
      paths.manage({ info: InfoCode.SubscriptionCancelled }),
    );
  });

  fastify.get("/thank-you", async (request, reply) => {
    return reply.html(
      <ThankYouPage isAuthenticated={isAuthenticated(request, reply)} />,
    );
  });

  fastify.post("/webhook", { preParsing: rawBody }, async (request, reply) => {
    const webhookSecret = config.stripeWebhookSecret;
    if (!webhookSecret) {
      fastify.log.error("Stripe webhook secret is not configured");
      return reply.status(500).send({ error: "Webhook not configured" });
    }

    const body = request.rawBody;
    if (!body) {
      fastify.log.error("Missing request.rawBody");
      return reply.status(500).send({ error: "Missing raw body data " });
    }

    const sig = request.headers["stripe-signature"];
    if (!sig) {
      fastify.log.warn("Missing Stripe signature header");
      return reply.status(400).send({ error: "Missing signature header" });
    }

    let event: Stripe.Event | undefined;
    try {
      event = await stripe.webhooks.constructEventAsync(
        body,
        sig,
        webhookSecret,
      );
    } catch (err) {
      fastify.log.warn({ err }, "Webhook signature verification failed");
      return reply.status(400).send({ error: "Invalid signature" });
    }

    try {
      await subscriptionManager.processWebhook(event);
    } catch (err) {
      fastify.log.error(
        { err, eventType: event.type },
        "Webhook processing error",
      );
      // Still return 200 to prevent Stripe retries for processing errors
    }

    return reply.status(200).send({ received: true });
  });

  fastify.get("/healthz", async (_request, reply) => {
    return reply.status(200).send({ status: "ok" });
  });
}
