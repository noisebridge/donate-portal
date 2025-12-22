import crypto from "node:crypto";
// biome-ignore lint/correctness/noUnusedImports: Html is used by JSX
import Html from "@kitajs/html";
import type {
  FastifyInstance,
  FastifyReply,
  FastifyRequest,
  RouteShorthandOptions,
} from "fastify";
import donationManager from "~/managers/donation";
import magicLinkManager from "~/managers/magic-link";
import subscriptionManager, {
  type SubscriptionInfo,
} from "~/managers/subscription";
import githubOAuth from "~/services/github";
import googleOAuth from "~/services/google";
import { CookieName, cookies } from "~/signed-cookies";
import { AuthPage } from "~/views/auth";
import { AuthEmailPage } from "~/views/auth/email";
import { IndexPage } from "~/views/index";
import { ManagePage } from "~/views/manage";
import { ThankYouPage } from "~/views/thank-you";
import emailManager from "./managers/email";
import { parseToCents, validateAmountFormData } from "./money";
import { ErrorPage } from "./views/error";

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

const paths = {
  index: (error?: string) =>
    error ? `/?error=${encodeURIComponent(error)}` : `/`,
  signIn: (error?: string) =>
    error ? `/auth?error=${encodeURIComponent(error)}` : `/auth`,
  waitForEmail: (email: string) =>
    `/auth/email?email=${encodeURIComponent(email)}`,
  signOut: "/auth/signout",
  githubStart: "/auth/github/start",
  googleStart: "/auth/google/start",
  manage: (error?: string) =>
    error ? `/manage?error=${encodeURIComponent(error)}` : `/manage`,
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
}

export function errorRoute(
  fastify: FastifyInstance,
): Parameters<FastifyInstance["setErrorHandler"]>[0] {
  return (error, request, reply) => {
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
  };
}

function isAuthenticated(
  request: FastifyRequest,
  reply: FastifyReply,
): boolean {
  return cookies[CookieName.UserSession](request, reply).valid();
}

export default async function routes(fastify: FastifyInstance) {
  fastify.get<{
    Querystring: { error?: string };
  }>("/", async (request, reply) => {
    const error = request.query.error;
    return reply.html(
      <IndexPage
        isAuthenticated={isAuthenticated(request, reply)}
        error={error}
      />,
    );
  });

  fastify.get<{
    Querystring: { error?: string };
  }>("/auth", async (request, reply) => {
    if (isAuthenticated(request, reply)) {
      return reply.redirect(paths.manage());
    }

    const error = request.query.error;
    return reply.html(
      <AuthPage
        isAuthenticated={isAuthenticated(request, reply)}
        error={error}
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
    Querystring: { code?: string; state?: string; error?: string };
  }>("/auth/github/callback", async (request, reply) => {
    if (request.query.error) {
      fastify.log.warn({ error: request.query.error }, "GitHub OAuth error");
      return reply.redirect(paths.signIn(ErrorCode.GithubError));
    }

    const { code, state } = request.query;
    if (!code || !state) {
      fastify.log.warn("Missing code or state parameter in callback");
      return reply.redirect(paths.signIn(ErrorCode.InvalidRequest));
    }

    const githubCookie = cookies[CookieName.GithubOAuthState](request, reply);
    const cookieValue = githubCookie.value;
    if (cookieValue?.state !== state) {
      fastify.log.warn("Invalid or mismatched state parameter");
      return reply.redirect(paths.signIn(ErrorCode.InvalidState));
    }

    githubCookie.clear();

    const { user, primaryEmail } = await githubOAuth.completeOAuthFlow(code);
    const email = primaryEmail || user.email;
    if (!email) {
      fastify.log.warn(
        { userId: user.id, login: user.login },
        "No email found for GitHub user",
      );
      return reply.redirect(paths.signIn(ErrorCode.NoEmail));
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
    Querystring: { code?: string; state?: string; error?: string };
  }>("/auth/google/callback", async (request, reply) => {
    if (request.query.error) {
      fastify.log.warn({ error: request.query.error }, "Google OAuth error");
      return reply.redirect(paths.signIn(ErrorCode.GoogleError));
    }

    const { code, state } = request.query;
    if (!code || !state) {
      fastify.log.warn("Missing code or state parameter in Google callback");
      return reply.redirect(paths.signIn(ErrorCode.InvalidRequest));
    }

    const googleCookie = cookies[CookieName.GoogleOAuthState](request, reply);
    const cookieValue = googleCookie.value;
    if (cookieValue?.state !== state) {
      fastify.log.warn(
        "Invalid or mismatched state parameter for Google OAuth",
      );
      return reply.redirect(paths.signIn(ErrorCode.InvalidState));
    }

    googleCookie.clear();

    const { userInfo } = await googleOAuth.completeOAuthFlow(code);
    if (!userInfo.email || !userInfo.verified_email) {
      fastify.log.warn(
        { userId: userInfo.id },
        "No verified email found for Google user",
      );
      return reply.redirect(paths.signIn(ErrorCode.NoEmail));
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
      return reply.redirect(paths.signIn(ErrorCode.InvalidRequest));
    }

    // Basic email validation
    if (!email.includes("@") || email.length < 5) {
      fastify.log.warn({ email }, "Invalid email format");
      return reply.redirect(paths.signIn(ErrorCode.EmailInvalid));
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
      return reply.redirect(paths.signIn(ErrorCode.InvalidRequest));
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
      return reply.redirect(paths.signIn(ErrorCode.InvalidRequest));
    }

    // Decode the state parameter
    const magicLinkState = magicLinkManager.decodeMagicLinkState(state);
    if (!magicLinkState) {
      fastify.log.warn("Invalid state parameter in magic link callback");
      return reply.redirect(paths.signIn(ErrorCode.InvalidMagicLink));
    }

    const { email, code } = magicLinkState;

    // Verify the HMAC code (checks current, 1 past, and 1 future time window)
    const isValid = magicLinkManager.verifyMagicLinkCode(email, code);
    if (!isValid) {
      fastify.log.warn({ email }, "Invalid or expired magic link code");
      return reply.redirect(paths.signIn(ErrorCode.MagicLinkExpired));
    }

    // Code is valid - create session
    const sessionCookie = cookies[CookieName.UserSession](request, reply);
    sessionCookie.value = { email, provider: "magic_link" };

    fastify.log.info({ email }, "User authenticated via magic link");

    return reply.redirect(paths.manage());
  });

  fastify.get("/auth/signout", async (request, reply) => {
    const sessionCookie = cookies[CookieName.UserSession](request, reply);
    sessionCookie.clear();

    return reply.redirect(paths.index());
  });

  fastify.get<{
    Querystring: { error?: string };
  }>("/manage", async (request, reply) => {
    const sessionCookie = cookies[CookieName.UserSession](request, reply);
    const sessionData = sessionCookie.value;
    if (!sessionData) {
      fastify.log.debug("No valid session found, redirecting to auth");
      sessionCookie.clear();
      return reply.redirect(paths.index());
    }

    let customerSubscription: SubscriptionInfo | undefined;
    try {
      customerSubscription = await subscriptionManager.getSubscription(
        sessionData.email,
      );
    } catch (error) {
      fastify.log.error(
        error,
        "Error fetching Stripe customer/subscription data",
      );
    }
    if (!customerSubscription) {
      throw new Error("No customer subscription found");
    }

    const error = request.query.error;
    return reply.html(
      <ManagePage
        email={sessionData.email}
        customer={customerSubscription.customer}
        subscription={customerSubscription.subscription}
        error={error}
      />,
    );
  });

  fastify.post("/donate", async (request, reply) => {
    const body = request.body;
    if (!validateAmountFormData(body)) {
      return reply.redirect(paths.index(ErrorCode.InvalidRequest));
    }

    const amountCents = parseToCents(body);
    if (amountCents === null) {
      fastify.log.warn({ body }, "Invalid subscription amount");
      return reply.redirect(
        paths.index(ErrorCode.InvalidMonthlyDonationAmount),
      );
    }

    const result = await donationManager.donate(amountCents);
    if (!result.success) {
      fastify.log.error(`Couldn't initiate Stripe donation: ${result.error}`);
      return reply.redirect(paths.index(result.error));
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
      return reply.redirect(paths.index(ErrorCode.InvalidDonationAmount));
    }

    const result = await donationManager.donate(amountCents, name, description);
    if (!result.success) {
      fastify.log.error(`Coudn't initiate Stripe donation: ${result.error}`);
      return reply.redirect(paths.index(result.error));
    }

    fastify.log.info(
      { amount: amountCents, sessionId: result.sessionId },
      "Stripe checkout session created for QR donation",
    );

    return reply.redirect(result.checkoutUrl);
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
      return reply.redirect(paths.manage(ErrorCode.InvalidRequest));
    }

    const amountCents = parseToCents(body);
    if (amountCents === null) {
      fastify.log.warn(
        { body, email: sessionData.email },
        "Invalid subscription amount",
      );
      return reply.redirect(
        paths.manage(ErrorCode.InvalidMonthlyDonationAmount),
      );
    }

    const result = await subscriptionManager.subscribe(
      sessionData.email,
      amountCents,
    );
    if (!result.success) {
      return reply.redirect(paths.manage(result.error));
    }
    if (!result.checkoutUrl) {
      // If a subscription is updated there is no checkout process
      return reply.redirect(paths.manage());
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
      return reply.redirect(paths.manage(result.error));
    }

    fastify.log.info({ email: sessionData.email }, "Subscription canceled");

    return reply.redirect(paths.manage());
  });

  fastify.get("/thank-you", async (request, reply) => {
    return reply.html(
      <ThankYouPage isAuthenticated={isAuthenticated(request, reply)} />,
    );
  });

  fastify.get("/healthz", async (_request, reply) => {
    return reply.status(200).send({ status: "ok" });
  });
}
