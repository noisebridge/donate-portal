import crypto from "node:crypto";
import stream from "node:stream";
import createError from "@fastify/error";
import type {
  FastifyInstance,
  FastifyReply,
  FastifyRequest,
  RouteShorthandOptions,
} from "fastify";
import type Stripe from "stripe";
import config from "~/config";
import {
  ErrorCode,
  formatMessages,
  isErrorCodeKey,
  isInfoCodeKey,
} from "~/lib/error-codes";
import baseLogger from "~/lib/logger";
import { parseToCents, validateAmountFormData } from "~/lib/money";
import paths, { type MessageParams } from "~/lib/paths";
import { CookieName, cookies } from "~/lib/signed-cookies";
import { timingSafeStringEqual } from "~/lib/timing-safe-equal";
import chargeAlertManager from "~/managers/charge-alert";
import * as donationManager from "~/managers/donation";
import * as emailManager from "~/managers/email";
import * as magicLinkManager from "~/managers/magic-link";
import * as qrCodeManager from "~/managers/qr-code";
import * as subscriptionManager from "~/managers/subscription";
import * as errorReportingService from "~/services/error-reporting";
import * as githubOAuth from "~/services/github";
import * as googleOAuth from "~/services/google";
import * as keycloakOAuth from "~/services/keycloak";
import stripe from "~/services/stripe";
import { AlertsPage } from "~/views/alerts";
import { AuthPage } from "~/views/auth";
import { AuthEmailPage } from "~/views/auth/email";
import { ErrorPage } from "~/views/error";
import { IndexPage } from "~/views/index";
import { ManagePage } from "~/views/manage";
import { NotFoundPage } from "~/views/not-found";
import { QrPage } from "~/views/qr";
import { QrEditorPage } from "~/views/qr-editor";
import { ThankYouPage } from "~/views/thank-you";

/**
 * Raw `error`/`info` query parameters, as received from the query string
 * before validation.
 */
type RawMessageParams = {
  [K in keyof MessageParams]: string | string[] | undefined;
};

/**
 * The `error` and `info` query parameters arrive as arbitrary strings, but
 * are only meaningful when they name a known message code. Validate them
 * before treating them as message keys.
 */
function parseMessageParams(query: RawMessageParams): MessageParams {
  const { error, info } = query;
  return {
    error: isErrorCodeKey(error) ? error : undefined,
    info: isInfoCodeKey(info) ? info : undefined,
  };
}

function conditionalRateLimit(
  max: number,
  timeWindow: string,
): RouteShorthandOptions {
  if (config.disableRateLimit) {
    return {};
  }

  return { config: { rateLimit: { max, timeWindow } } };
}

const authRateLimit = conditionalRateLimit(3, "1 minute");
const donationRateLimit = conditionalRateLimit(3, "1 minute");
const errorReportingRateLimit = conditionalRateLimit(3, "1 minute");
const cspReportRateLimit = conditionalRateLimit(10, "1 minute");
const alertsRateLimit = conditionalRateLimit(10, "1 minute");

/**
 * Cryptographically secure random string for use with OAuth.
 */
function getRandomState() {
  return crypto.randomBytes(32).toString("hex");
}

function isAuthenticated(
  request: FastifyRequest,
  reply: FastifyReply,
): boolean {
  return cookies[CookieName.UserSession](request, reply).valid();
}

function verifyBasicAuth(request: FastifyRequest) {
  const auth = request.headers.authorization;
  if (!auth?.startsWith("Basic ")) {
    return false;
  }

  const decoded = Buffer.from(auth.slice("Basic ".length), "base64").toString();
  const separator = decoded.indexOf(":");
  if (separator === -1) {
    return false;
  }

  const usernameValid = timingSafeStringEqual(
    decoded.slice(0, separator),
    config.alertsUsername,
  );
  const passwordValid = timingSafeStringEqual(
    decoded.slice(separator + 1),
    config.alertsPassword,
  );

  return usernameValid && passwordValid;
}

const PayloadTooLargeError = createError(
  "PAYLOAD_TOO_LARGE",
  "Request body is too large",
  413,
);

export const maxRawBodyBytes = 256 * 1024;

/**
 * Fastify preParsing hook to capture raw request body for webhook signature verification.
 */
async function rawBody(
  request: FastifyRequest,
  _reply: FastifyReply,
  payload: stream.Readable,
): Promise<stream.Readable> {
  const chunks: Buffer[] = [];
  // bodyLimit is enforced by the content type parser, which runs after this
  // hook has already buffered the whole stream — so cap the size here too.
  // Drain (rather than abort) past the cap; destroying the stream mid-upload
  // tears down the socket before the 413 response can be written.
  let received = 0;
  for await (const chunk of payload) {
    if (!Buffer.isBuffer(chunk)) {
      throw new Error("Expected chunk to be a Buffer");
    }

    received += chunk.length;
    if (received > maxRawBodyBytes) {
      chunks.length = 0;
      continue;
    }

    chunks.push(chunk);
  }

  if (received > maxRawBodyBytes) {
    throw new PayloadTooLargeError();
  }

  request.rawBody = Buffer.concat(chunks);

  return stream.Readable.from([request.rawBody]);
}

export default async function routes(fastify: FastifyInstance) {
  fastify.setErrorHandler(
    (thrown: unknown, request: FastifyRequest, reply: FastifyReply) => {
      const error =
        thrown instanceof Error
          ? thrown
          : new Error(`Unknown error: ${thrown}`);

      const statusCode =
        "statusCode" in error &&
        typeof error.statusCode === "number" &&
        error.statusCode >= 400 &&
        error.statusCode < 600
          ? error.statusCode
          : 500;

      fastify.log.error(
        {
          err: error,
          url: request.url,
          method: request.method,
        },
        "Unhandled error in route",
      );

      // Client errors (CSRF failures, rate limits, oversized bodies) are
      // attacker-triggerable, so only forward server errors to Sentry.
      if (statusCode >= 500) {
        errorReportingService
          .reportBackend(error, request)
          .catch((err) => baseLogger.error({ err }, "Failed to report error"));
      }

      reply
        .status(statusCode)
        .html(
          <ErrorPage
            isAuthenticated={isAuthenticated(request, reply)}
            error={error}
            csrfToken={reply.generateCsrf()}
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
      .html(
        <NotFoundPage
          isAuthenticated={isAuthenticated(request, reply)}
          csrfToken={reply.generateCsrf()}
        />,
      );
  });

  fastify.get<{
    Querystring: RawMessageParams;
  }>(paths.index(), async (request, reply) => {
    return reply.html(
      <IndexPage
        isAuthenticated={isAuthenticated(request, reply)}
        messages={formatMessages(parseMessageParams(request.query))}
        csrfToken={reply.generateCsrf()}
      />,
    );
  });

  fastify.get<{
    Querystring: RawMessageParams;
  }>(paths.signIn(), async (request, reply) => {
    const authenticated = isAuthenticated(request, reply);
    if (authenticated) {
      return reply.redirect(paths.manage());
    }

    // Clear all OAuth cookies
    cookies[CookieName.GithubOAuthState](request, reply).clear();
    cookies[CookieName.GoogleOAuthState](request, reply).clear();
    cookies[CookieName.KeycloakOAuthState](request, reply).clear();

    return reply.html(
      <AuthPage
        isAuthenticated={authenticated}
        messages={formatMessages(parseMessageParams(request.query))}
        csrfToken={reply.generateCsrf()}
      />,
    );
  });

  fastify.get(paths.githubStart(), authRateLimit, async (request, reply) => {
    if (isAuthenticated(request, reply)) {
      return reply.redirect(paths.manage());
    }

    const state = getRandomState();
    const githubCookie = cookies[CookieName.GithubOAuthState](request, reply);
    githubCookie.value = { state, issued: Date.now() };

    const authUrl = githubOAuth.getAuthorizationUrl(state, ["user:email"]);
    return reply.redirect(authUrl);
  });

  fastify.get<{
    Querystring: { code?: string; state?: string; error?: string };
  }>(paths.githubCallback(), async (request, reply) => {
    if (request.query.error) {
      fastify.log.warn({ error: request.query.error }, "GitHub OAuth error");
      return reply.redirect(paths.signIn({ error: "GithubError" }));
    }

    const { code, state } = request.query;
    if (!code || !state) {
      fastify.log.warn("Missing code or state parameter in callback");
      return reply.redirect(paths.signIn({ error: "InvalidRequest" }));
    }

    const githubCookie = cookies[CookieName.GithubOAuthState](request, reply);
    const cookieValue = githubCookie.value;
    githubCookie.clear();
    if (cookieValue?.state !== state) {
      fastify.log.warn("Invalid or mismatched state parameter");
      return reply.redirect(paths.signIn({ error: "InvalidState" }));
    }

    const oauthResult = await githubOAuth.completeFlow(code);
    if (!oauthResult) {
      return reply.redirect(paths.signIn({ error: "OAuthFailed" }));
    }

    const { user, primaryEmail } = oauthResult;
    const email = primaryEmail;
    if (!email) {
      fastify.log.warn(
        { userId: user.id, login: user.login },
        "No verified primary email found for GitHub user",
      );
      return reply.redirect(paths.signIn({ error: "NoEmail" }));
    }

    const sessionCookie = cookies[CookieName.UserSession](request, reply);
    sessionCookie.value = {
      email: email,
      provider: "github",
      issued: Date.now(),
    };

    fastify.log.info(
      { userId: user.id, login: user.login, email, ip: request.ip },
      "User authenticated via GitHub",
    );

    return reply.redirect(paths.manage());
  });

  fastify.get(paths.googleStart(), authRateLimit, async (request, reply) => {
    if (isAuthenticated(request, reply)) {
      return reply.redirect(paths.manage());
    }

    const state = getRandomState();
    const googleCookie = cookies[CookieName.GoogleOAuthState](request, reply);
    googleCookie.value = { state, issued: Date.now() };

    const authUrl = googleOAuth.getAuthorizationUrl(state, [
      "openid",
      "https://www.googleapis.com/auth/userinfo.email",
      "https://www.googleapis.com/auth/userinfo.profile",
    ]);
    return reply.redirect(authUrl);
  });

  fastify.get<{
    Querystring: { code?: string; state?: string; error?: string };
  }>(paths.googleCallback(), async (request, reply) => {
    if (request.query.error) {
      fastify.log.warn({ error: request.query.error }, "Google OAuth error");
      return reply.redirect(paths.signIn({ error: "GoogleError" }));
    }

    const { code, state } = request.query;
    if (!code || !state) {
      fastify.log.warn("Missing code or state parameter in Google callback");
      return reply.redirect(paths.signIn({ error: "InvalidRequest" }));
    }

    const googleCookie = cookies[CookieName.GoogleOAuthState](request, reply);
    const cookieValue = googleCookie.value;
    googleCookie.clear();
    if (cookieValue?.state !== state) {
      fastify.log.warn(
        "Invalid or mismatched state parameter for Google OAuth",
      );
      return reply.redirect(paths.signIn({ error: "InvalidState" }));
    }

    const oauthResult = await googleOAuth.completeFlow(code);
    if (!oauthResult) {
      return reply.redirect(paths.signIn({ error: "OAuthFailed" }));
    }

    const { userInfo } = oauthResult;
    if (!userInfo.email || !userInfo.verified_email) {
      fastify.log.warn(
        { userId: userInfo.id },
        "No verified email found for Google user",
      );
      return reply.redirect(paths.signIn({ error: "NoEmail" }));
    }

    const sessionCookie = cookies[CookieName.UserSession](request, reply);
    sessionCookie.value = {
      email: userInfo.email,
      provider: "google",
      issued: Date.now(),
    };

    fastify.log.info(
      { userId: userInfo.id, email: userInfo.email, ip: request.ip },
      "User authenticated via Google",
    );

    return reply.redirect(paths.manage());
  });

  fastify.get(paths.keycloakStart(), authRateLimit, async (request, reply) => {
    if (isAuthenticated(request, reply)) {
      return reply.redirect(paths.manage());
    }

    const state = getRandomState();
    const keycloakCookie = cookies[CookieName.KeycloakOAuthState](
      request,
      reply,
    );
    keycloakCookie.value = { state, issued: Date.now() };

    const authUrl = keycloakOAuth.getAuthorizationUrl(state, [
      "openid",
      "email",
      "profile",
    ]);
    return reply.redirect(authUrl);
  });

  fastify.get<{
    Querystring: { code?: string; state?: string; error?: string };
  }>(paths.keycloakCallback(), async (request, reply) => {
    if (request.query.error) {
      fastify.log.warn({ error: request.query.error }, "Keycloak OAuth error");
      return reply.redirect(paths.signIn({ error: "KeycloakError" }));
    }

    const { code, state } = request.query;
    if (!code || !state) {
      fastify.log.warn("Missing code or state parameter in Keycloak callback");
      return reply.redirect(paths.signIn({ error: "InvalidRequest" }));
    }

    const keycloakCookie = cookies[CookieName.KeycloakOAuthState](
      request,
      reply,
    );
    const cookieValue = keycloakCookie.value;
    keycloakCookie.clear();
    if (cookieValue?.state !== state) {
      fastify.log.warn(
        "Invalid or mismatched state parameter for Keycloak OAuth",
      );
      return reply.redirect(paths.signIn({ error: "InvalidState" }));
    }

    const oauthResult = await keycloakOAuth.completeFlow(code);
    if (!oauthResult) {
      return reply.redirect(paths.signIn({ error: "OAuthFailed" }));
    }

    const { userInfo } = oauthResult;
    const sessionCookie = cookies[CookieName.UserSession](request, reply);
    sessionCookie.value = {
      email: userInfo.email,
      provider: "keycloak",
      issued: Date.now(),
    };

    fastify.log.info(
      { userId: userInfo.sub, email: userInfo.email, ip: request.ip },
      "User authenticated via Keycloak",
    );

    return reply.redirect(paths.manage());
  });

  fastify.post<{
    Body: { email?: string };
  }>(
    paths.emailAuth(),
    { ...authRateLimit, preHandler: fastify.csrfProtection },
    async (request, reply) => {
      if (isAuthenticated(request, reply)) {
        return reply.redirect(paths.manage());
      }

      const email = request.body?.email?.trim();

      if (!email) {
        fastify.log.warn("Missing email in POST /auth/email");
        return reply.redirect(paths.signIn({ error: "InvalidRequest" }));
      }

      if (!emailManager.isValid(email)) {
        fastify.log.warn({ email }, "Invalid email format");
        return reply.redirect(paths.signIn({ error: "EmailInvalid" }));
      }

      const response = await emailManager.sendMagicLink(email);
      if (!response.success) {
        fastify.log.error(
          { email, error: response.error },
          "Failed to send magic link email",
        );
        return reply.redirect(paths.signIn({ error: "EmailSendFailed" }));
      }
      fastify.log.info({ email, id: response.id }, "Magic link email sent");

      return reply.redirect(paths.emailAuth(email));
    },
  );

  fastify.get<{
    Querystring: { email?: string };
  }>(paths.emailAuth(), async (request, reply) => {
    if (isAuthenticated(request, reply)) {
      return reply.redirect(paths.manage());
    }

    const email = request.query.email;
    if (!email || !emailManager.isValid(email)) {
      fastify.log.warn("Missing or invalid email parameter");
      return reply.redirect(paths.signIn({ error: "InvalidRequest" }));
    }

    return reply.html(
      <AuthEmailPage
        email={email}
        isAuthenticated={isAuthenticated(request, reply)}
        csrfToken={reply.generateCsrf()}
      />,
    );
  });

  fastify.get<{
    Querystring: { state?: string };
  }>(paths.emailCallback(), async (request, reply) => {
    const { state } = request.query;

    if (!state) {
      fastify.log.warn("Missing state parameter in magic link callback");
      return reply.redirect(paths.signIn({ error: "InvalidRequest" }));
    }

    const magicLinkState = magicLinkManager.decodeState(state);
    if (!magicLinkState) {
      fastify.log.warn("Invalid state parameter in magic link callback");
      return reply.redirect(paths.signIn({ error: "InvalidMagicLink" }));
    }

    const { email, code } = magicLinkState;

    const isValid = magicLinkManager.verifyCode(email, code);
    if (!isValid) {
      fastify.log.warn({ email }, "Invalid or expired magic link code");
      return reply.redirect(paths.signIn({ error: "MagicLinkExpired" }));
    }

    const sessionCookie = cookies[CookieName.UserSession](request, reply);
    sessionCookie.value = {
      email,
      provider: "magic_link",
      issued: Date.now(),
    };

    fastify.log.info(
      { email, ip: request.ip },
      "User authenticated via magic link",
    );

    return reply.redirect(paths.manage());
  });

  fastify.post(
    paths.signOut(),
    { preHandler: fastify.csrfProtection },
    async (request, reply) => {
      const sessionCookie = cookies[CookieName.UserSession](request, reply);
      sessionCookie.clear();

      return reply.redirect(paths.index());
    },
  );

  fastify.get<{
    Querystring: RawMessageParams;
  }>(paths.manage(), async (request, reply) => {
    const sessionCookie = cookies[CookieName.UserSession](request, reply);
    const sessionData = sessionCookie.value;
    if (!sessionData) {
      fastify.log.debug("No valid session found, redirecting home");
      sessionCookie.clear();
      return reply.redirect(paths.index());
    }

    const customerSubscription = await subscriptionManager.get(
      sessionData.email,
    );

    const messages = formatMessages(parseMessageParams(request.query));
    if (customerSubscription.subscription?.status === "past_due") {
      messages.push({
        type: "error",
        text: ErrorCode.PastDue,
        dismissable: false,
      });
    }

    reply.header("Cache-Control", "no-store");

    return reply.html(
      <ManagePage
        email={sessionData.email}
        subscription={customerSubscription.subscription}
        messages={messages}
        csrfToken={reply.generateCsrf()}
      />,
    );
  });

  fastify.post<{
    // Untrusted form data; validateAmountFormData narrows it below.
    Body: {
      "amount-dollars"?: string;
      "custom-amount"?: string;
      name?: string;
      description?: string;
    };
  }>(
    paths.donate(),
    { ...donationRateLimit, preHandler: fastify.csrfProtection },
    async (request, reply) => {
      const body = request.body;
      if (!validateAmountFormData(body)) {
        return reply.send({
          redirect: paths.index({ error: "InvalidRequest" }),
        });
      }

      const amountCents = parseToCents(body);
      if (amountCents === null) {
        fastify.log.warn({ body }, "Invalid donation amount");
        return reply.send({
          redirect: paths.index({ error: "InvalidDonationAmount" }),
        });
      }

      const { name, description } = body;
      if (!donationManager.validateParams(name, description)) {
        return reply.send({
          redirect: paths.index({ error: "InvalidRequest" }),
        });
      }

      const result = await donationManager.donate(
        amountCents,
        name,
        description,
      );
      if (!result.success) {
        fastify.log.error(`Couldn't initiate Stripe donation: ${result.error}`);
        return reply.send({
          redirect: paths.index({ error: result.error }),
        });
      }

      fastify.log.info(
        { amount: amountCents },
        "Stripe PaymentIntent created for donation",
      );

      const sessionCookie = cookies[CookieName.UserSession](request, reply);
      const emailAddress = sessionCookie.value?.email ?? null;

      return reply.send({ clientSecret: result.clientSecret, emailAddress });
    },
  );

  fastify.get<{
    Querystring: { name?: string; description?: string; amount?: string };
  }>(paths.qr(), async (request, reply) => {
    const { name, description, amount } = request.query;

    const amountCents = parseToCents(amount ?? "");
    if (amountCents === null) {
      return reply.redirect(paths.index({ error: "InvalidDonationAmount" }));
    }

    if (!donationManager.validateParams(name, description)) {
      return reply.status(400).send("Invalid name or description");
    }

    return reply.html(
      <QrPage
        amount={amountCents}
        name={name}
        description={description}
        isAuthenticated={isAuthenticated(request, reply)}
        csrfToken={reply.generateCsrf()}
      />,
    );
  });

  fastify.get<{
    Querystring: {
      name?: string;
      description?: string;
      amount?: string;
      "use-logo"?: string;
    };
  }>(paths.qrSvg(), async (request, reply) => {
    const { name, description, amount, "use-logo": useLogo } = request.query;

    const amountCents = parseToCents(amount ?? "");
    if (amountCents === null) {
      return reply.status(400).send("Invalid amount");
    }

    if (!donationManager.validateParams(name, description)) {
      return reply.status(400).send("Invalid name or description");
    }

    const includelogo = useLogo !== "false";
    const url = `${config.baseUrl}${paths.qr(amountCents, name, description)}`;
    const qrCode = qrCodeManager.create(url, includelogo);

    return reply
      .header("Cache-Control", "no-cache, no-store, must-revalidate")
      .type("image/svg+xml")
      .send(qrCode.svg({ container: "svg-viewbox" }));
  });

  fastify.get(paths.qrEditor(), async (request, reply) => {
    return reply.html(
      <QrEditorPage
        isAuthenticated={isAuthenticated(request, reply)}
        csrfToken={reply.generateCsrf()}
      />,
    );
  });

  fastify.post(
    paths.subscribe(),
    { ...donationRateLimit, preHandler: fastify.csrfProtection },
    async (request, reply) => {
      const sessionCookie = cookies[CookieName.UserSession](request, reply);
      const sessionData = sessionCookie.value;
      if (!sessionData) {
        fastify.log.warn("Unauthenticated subscription attempt");
        return reply.send({ redirect: paths.signIn() });
      }

      const body = request.body;
      if (!validateAmountFormData(body)) {
        return reply.send({
          redirect: paths.manage({ error: "InvalidRequest" }),
        });
      }

      const amountCents = parseToCents(body);
      if (amountCents === null) {
        fastify.log.warn(
          { body, email: sessionData.email },
          "Invalid subscription amount",
        );
        return reply.send({
          redirect: paths.manage({
            error: "InvalidMonthlyDonationAmount",
          }),
        });
      }

      const result = await subscriptionManager.subscribe(
        sessionData.email,
        amountCents,
      );
      if (!result.success) {
        return reply.send({
          redirect: paths.manage({ error: result.error }),
        });
      }
      if (!result.clientSecret) {
        // Subscription was updated, no payment needed
        return reply.send({
          redirect: paths.manage({ info: "SubscriptionUpdated" }),
        });
      }

      fastify.log.info(
        {
          amount: amountCents,
          email: sessionData.email,
        },
        "Stripe subscription created with incomplete payment",
      );

      return reply.send({
        clientSecret: result.clientSecret,
        emailAddress: sessionData.email ?? null,
      });
    },
  );

  fastify.post(
    paths.stripePortal(),
    { preHandler: fastify.csrfProtection },
    async (request, reply) => {
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
    },
  );

  fastify.post(
    paths.cancel(),
    { preHandler: fastify.csrfProtection },
    async (request, reply) => {
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

      return reply.redirect(paths.manage({ info: "SubscriptionCancelled" }));
    },
  );

  fastify.get(paths.alerts(), alertsRateLimit, async (request, reply) => {
    if (!verifyBasicAuth(request)) {
      return reply
        .status(401)
        .header("WWW-Authenticate", 'Basic realm="Alerts"')
        .send("Unauthorized");
    }

    const alerts = await chargeAlertManager.getRecentAlerts();
    return reply.html(<AlertsPage alerts={alerts} />);
  });

  fastify.get(
    paths.alertsWs(),
    { ...alertsRateLimit, websocket: true },
    async (socket, request) => {
      if (!verifyBasicAuth(request)) {
        socket.close(1008, "Unauthorized");
        return;
      }

      chargeAlertManager.addConnection(socket);
    },
  );

  fastify.get(paths.thankYou(), async (request, reply) => {
    return reply.html(
      <ThankYouPage
        isAuthenticated={isAuthenticated(request, reply)}
        csrfToken={reply.generateCsrf()}
      />,
    );
  });

  fastify.post(
    paths.webhook(),
    { preParsing: rawBody },
    async (request, reply) => {
      const webhookSecret = config.stripeWebhookSecret;
      if (!webhookSecret) {
        fastify.log.error("Stripe webhook secret is not configured");
        return reply.status(500).send({ error: "Webhook not configured" });
      }

      const body = request.rawBody;
      if (!body) {
        fastify.log.error("Missing request.rawBody");
        return reply.status(500).send({ error: "Missing raw body data" });
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
        // Anyone can POST garbage here, so log instead of forwarding to
        // Sentry — otherwise this is a vector for flooding error reports.
        fastify.log.warn({ err }, "Webhook signature verification failed");
        return reply.status(400).send({ error: "Invalid signature" });
      }

      try {
        switch (event.type) {
          case "payment_intent.succeeded":
            await chargeAlertManager.handlePaymentSuccess(event);
            break;
          case "customer.subscription.created":
            await chargeAlertManager.handleNewSubscription(event);
            break;
          case "invoice.paid":
            await subscriptionManager.handleInvoicePaid(event);
            break;
          case "customer.subscription.updated":
            await subscriptionManager.handleSubscriptionUpdated(event);
            break;
        }
      } catch (err) {
        fastify.log.error(
          { err, eventType: event.type },
          "Webhook processing error",
        );
        if (err instanceof Error) {
          await errorReportingService.reportBackend(err, request);
        }
        // Still return 200 to prevent Stripe retries for processing errors
      }

      return reply.status(200).send({ received: true });
    },
  );

  fastify.post(
    paths.errorReporting(),
    errorReportingRateLimit,
    async (request, reply) => {
      if (request.headers["content-type"] !== "text/plain;charset=UTF-8") {
        return reply.status(415).send();
      }

      const body = request.body;
      if (typeof body !== "string") {
        return reply.status(400).send();
      }

      let event: unknown;
      try {
        event = JSON.parse(body);
      } catch {
        return reply.status(400).send();
      }

      if (!errorReportingService.validateSentryEvent(event)) {
        return reply.status(400).send();
      }

      const success = await errorReportingService.reportFrontend(event);
      if (!success) {
        return reply.status(502).send();
      }

      return reply.status(204).send();
    },
  );

  fastify.post(
    paths.cspReport(),
    cspReportRateLimit,
    async (request, reply) => {
      const contentType = request.headers["content-type"];
      if (
        contentType !== "application/csp-report" &&
        contentType !== "application/json"
      ) {
        return reply.status(415).send();
      }

      const body = request.body;
      if (!body || typeof body !== "object") {
        return reply.status(400).send();
      }

      if (!errorReportingService.validateCspReport(body)) {
        return reply.status(400).send();
      }

      const success = await errorReportingService.reportCspViolation(body);
      if (!success) {
        return reply.status(502).send();
      }

      return reply.status(204).send();
    },
  );

  fastify.get(paths.healthz(), async (_request, reply) => {
    return reply.status(200).send({ status: "ok" });
  });
}
