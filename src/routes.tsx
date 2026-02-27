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
import chargeAlertManager from "~/managers/charge-alert";
import donationManager, { DonationManager } from "~/managers/donation";
import magicLinkManager from "~/managers/magic-link";
import qrCodeManager from "~/managers/qr-code";
import subscriptionManager from "~/managers/subscription";
import { parseToCents, validateAmountFormData } from "~/money";
import paths, { type MessageParams } from "~/paths";
import emailService from "~/services/email";
import errorReportingService, {
  type SentryEvent,
} from "~/services/error-reporting";
import githubOAuth from "~/services/github";
import googleOAuth from "~/services/google";
import stripe from "~/services/stripe";
import { CookieName, cookies } from "~/signed-cookies";
import { AlertsPage } from "~/views/alerts";
import { AuthPage } from "~/views/auth";
import { AuthEmailPage } from "~/views/auth/email";
import { ErrorPage } from "~/views/error";
import { IndexPage } from "~/views/index";
import { ManagePage } from "~/views/manage";
import { NotFoundPage } from "~/views/not-found";
import { QrPage } from "~/views/qr";
import { QrCustomPage } from "~/views/qr-custom";
import { QrEditorPage } from "~/views/qr-editor";
import { ThankYouPage } from "~/views/thank-you";
import { baseLogger } from "./logger";

function conditionalRateLimit(
  rateLimitConfig: RouteShorthandOptions,
): RouteShorthandOptions {
  if (config.disableRateLimit) {
    return {};
  }

  return rateLimitConfig;
}

const authRateLimit = conditionalRateLimit({
  config: {
    rateLimit: {
      max: 3,
      timeWindow: "1 minute",
    },
  },
});

const donationRateLimit = conditionalRateLimit({
  config: {
    rateLimit: {
      max: 3,
      timeWindow: "1 minute",
    },
  },
});

/**
 * Cryptographically secure random string for use with OAuth.
 */
function getRandomState() {
  return crypto.randomBytes(32).toString("hex");
}

enum ErrorCode {
  InvalidState = "Invalid OAuth state parameter",
  InvalidRequest = "Invalid request parameters",
  GithubError = "GitHub raised an error",
  GoogleError = "Google raised an error",
  OAuthFailed = "Failed to perform OAuth",
  NoEmail = "Could not find an email address for you",
  EmailInvalid = "Invalid email address",
  EmailSendFailed = "Failed to send email. Please try again.",
  InvalidMagicLink = "Invalid magic link",
  MagicLinkExpired = "Magic link has expired. Please request a new one.",
  InvalidDonationAmount = "Please select a valid donation amount",
  InvalidMonthlyDonationAmount = "Please select a valid donation amount",
  PastDue = "Your subscription is past due! Click the Payment Methods button to fix it.",
}

export enum InfoCode {
  SubscriptionCreated = "Your monthly donation has been set up. Thank you!",
  SubscriptionUpdated = "Your donation amount has been updated. The new amount will apply to the next billing cycle.",
  SubscriptionCancelled = "Your monthly donation has been cancelled. No further charges will be made.",
}

function isAuthenticated(
  request: FastifyRequest,
  reply: FastifyReply,
): boolean {
  return cookies[CookieName.UserSession](request, reply).valid();
}

function verifyBasicAuth(request: FastifyRequest) {
  const auth = request.headers.authorization;
  if (!auth || !auth.startsWith("Basic ")) {
    return false;
  }

  const decoded = Buffer.from(auth.slice(6), "base64").toString();
  const [username, password] = decoded.split(":", 2) as [
    string,
    string | undefined,
  ];

  if (
    username.length !== config.alertsUsername.length ||
    password?.length !== config.alertsPassword.length
  ) {
    return false;
  }

  if (
    !crypto.timingSafeEqual(
      Buffer.from(username),
      Buffer.from(config.alertsUsername),
    ) ||
    !crypto.timingSafeEqual(
      Buffer.from(password ?? ""),
      Buffer.from(config.alertsPassword),
    )
  ) {
    return false;
  }

  return true;
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
    (thrown: unknown, request: FastifyRequest, reply: FastifyReply) => {
      const error =
        thrown instanceof Error
          ? thrown
          : new Error(`Unknown error: ${thrown}`);
      fastify.log.error(
        {
          err: error,
          url: request.url,
          method: request.method,
        },
        "Unhandled error in route",
      );

      errorReportingService
        .reportBackend(error, request)
        .catch((err) => baseLogger.error({ err }, "Failed to report error"));

      reply
        .status(500)
        .html(
          <ErrorPage
            isAuthenticated={isAuthenticated(request, reply)}
            error={error}
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
    Querystring: MessageParams;
  }>(paths.index(), async (request, reply) => {
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
    Querystring: MessageParams;
  }>(paths.signIn(), async (request, reply) => {
    if (isAuthenticated(request, reply)) {
      return reply.redirect(paths.manage());
    }

    // Clear all OAuth cookies
    cookies[CookieName.GithubOAuthState](request, reply).clear();
    cookies[CookieName.GoogleOAuthState](request, reply).clear();

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

  fastify.get(paths.githubStart(), authRateLimit, async (request, reply) => {
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
    Querystring: { code?: string; state?: string } & MessageParams;
  }>(paths.githubCallback(), async (request, reply) => {
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

    const oauthResult = await githubOAuth.completeOAuthFlow(code);
    if (!oauthResult) {
      return reply.redirect(paths.signIn({ error: ErrorCode.OAuthFailed }));
    }

    const { user, primaryEmail } = oauthResult;
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

  fastify.get(paths.googleStart(), authRateLimit, async (request, reply) => {
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
    Querystring: { code?: string; state?: string } & MessageParams;
  }>(paths.googleCallback(), async (request, reply) => {
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

    const oauthResult = await googleOAuth.completeOAuthFlow(code);
    if (!oauthResult) {
      return reply.redirect(paths.signIn({ error: ErrorCode.OAuthFailed }));
    }

    const { userInfo } = oauthResult;
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
  }>(paths.emailAuth(), authRateLimit, async (request, reply) => {
    if (isAuthenticated(request, reply)) {
      return reply.redirect(paths.manage());
    }

    const email = request.body?.email?.trim();

    if (!email) {
      fastify.log.warn("Missing email in POST /auth/email");
      return reply.redirect(paths.signIn({ error: ErrorCode.InvalidRequest }));
    }

    // Basic email validation
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) {
      fastify.log.warn({ email }, "Invalid email format");
      return reply.redirect(paths.signIn({ error: ErrorCode.EmailInvalid }));
    }

    const response = await emailService.sendMagicLinkEmail(email);
    if (!response.success) {
      fastify.log.error(
        { email, error: response.error },
        "Failed to send magic link email",
      );
      return reply.redirect(paths.signIn({ error: ErrorCode.EmailSendFailed }));
    }
    fastify.log.info({ email, id: response.id }, "Magic link email sent");

    return reply.redirect(paths.emailAuth(email));
  });

  fastify.get<{
    Querystring: { email?: string };
  }>(paths.emailAuth(), async (request, reply) => {
    if (isAuthenticated(request, reply)) {
      return reply.redirect(paths.manage());
    }

    const email = request.query.email;
    if (!email) {
      fastify.log.warn("Missing email parameter");
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
  }>(paths.emailCallback(), async (request, reply) => {
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

  fastify.post(paths.signOut(), async (request, reply) => {
    const sessionCookie = cookies[CookieName.UserSession](request, reply);
    sessionCookie.clear();

    return reply.redirect(paths.index());
  });

  fastify.get<{
    Querystring: MessageParams;
  }>(paths.manage(), async (request, reply) => {
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
      messages.push({
        type: "error",
        text: ErrorCode.PastDue,
        dismissable: false,
      });
    }
    if (info) {
      messages.push({ type: "info", text: info });
    }

    reply.header("Cache-Control", "no-store");

    return reply.html(
      <ManagePage
        email={sessionData.email}
        subscription={customerSubscription.subscription}
        messages={messages}
      />,
    );
  });

  fastify.post<{
    Body: { name?: string; description?: string };
  }>(paths.donate(), donationRateLimit, async (request, reply) => {
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

    const { name, description } = body;
    if (name && name.length > DonationManager.maxNameLength) {
      return reply
        .status(400)
        .send(`Name length must be less than ${DonationManager.maxNameLength}`);
    }
    if (
      description &&
      description.length > DonationManager.maxDescriptionLength
    ) {
      return reply
        .status(400)
        .send(
          `Description length must be less than ${DonationManager.maxDescriptionLength}`,
        );
    }

    const result = await donationManager.donate(amountCents, name, description);
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
  }>(paths.qr(), async (request, reply) => {
    const { name, description, amount } = request.query;

    const amountCents = parseToCents(amount ?? "");
    if (amountCents === null) {
      return reply.redirect(
        paths.index({ error: ErrorCode.InvalidDonationAmount }),
      );
    }

    if (name && name.length > DonationManager.maxNameLength) {
      return reply
        .status(400)
        .send(`Name length must be less than ${DonationManager.maxNameLength}`);
    }

    if (
      description &&
      description.length > DonationManager.maxDescriptionLength
    ) {
      return reply
        .status(400)
        .send(
          `Description length must be less than ${DonationManager.maxDescriptionLength}`,
        );
    }

    return reply.html(
      <QrPage
        amount={amountCents}
        name={name}
        description={description}
        isAuthenticated={isAuthenticated(request, reply)}
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

    if (name && name.length > DonationManager.maxNameLength) {
      return reply
        .status(400)
        .send(`Name length must be less than ${DonationManager.maxNameLength}`);
    }

    if (
      description &&
      description.length > DonationManager.maxDescriptionLength
    ) {
      return reply
        .status(400)
        .send(
          `Description length must be less than ${DonationManager.maxDescriptionLength}`,
        );
    }

    const includelogo = useLogo !== "false";
    const url = `${config.baseUrl}${paths.qr(amountCents, name, description)}`;
    const qrCode = qrCodeManager.createQRCode(url, includelogo);

    return reply
      .header("Cache-Control", "no-cache, no-store, must-revalidate")
      .type("image/svg+xml")
      .send(qrCode.svg({ container: "svg-viewbox" }));
  });

  fastify.get<{
    Querystring: { name?: string; description?: string; amount?: string };
  }>(paths.qrCustom(), async (request, reply) => {
    const { name, description, amount } = request.query;

    const amountCents = parseToCents(amount ?? "");
    if (amountCents === null) {
      return reply.redirect(
        paths.index({ error: ErrorCode.InvalidDonationAmount }),
      );
    }

    if (name && name.length > DonationManager.maxNameLength) {
      return reply
        .status(400)
        .send(`Name length must be less than ${DonationManager.maxNameLength}`);
    }

    if (
      description &&
      description.length > DonationManager.maxDescriptionLength
    ) {
      return reply
        .status(400)
        .send(
          `Description length must be less than ${DonationManager.maxDescriptionLength}`,
        );
    }

    return reply.html(
      <QrCustomPage
        amount={amountCents}
        name={name}
        description={description}
        isAuthenticated={isAuthenticated(request, reply)}
      />,
    );
  });

  fastify.get(paths.qrEditor(), async (request, reply) => {
    return reply.html(
      <QrEditorPage isAuthenticated={isAuthenticated(request, reply)} />,
    );
  });

  fastify.post(paths.subscribe(), donationRateLimit, async (request, reply) => {
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

  fastify.post(paths.stripePortal(), async (request, reply) => {
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

  fastify.post(paths.cancel(), async (request, reply) => {
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

  fastify.get(paths.alerts(), async (request, reply) => {
    if (!verifyBasicAuth(request)) {
      return reply
        .status(401)
        .header("WWW-Authenticate", 'Basic realm="Alerts"')
        .send("Unauthorized");
    }

    const charges = await chargeAlertManager.fetchRecentCharges();
    return reply.html(<AlertsPage charges={charges} />);
  });

  fastify.get(
    paths.alertsWs(),
    { websocket: true },
    async (socket, request) => {
      if (!verifyBasicAuth(request)) {
        return;
      }

      await chargeAlertManager.addConnection(socket);
    },
  );

  fastify.get(paths.thankYou(), async (request, reply) => {
    return reply.html(
      <ThankYouPage isAuthenticated={isAuthenticated(request, reply)} />,
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
        fastify.log.warn({ err }, "Webhook signature verification failed");
        return reply.status(400).send({ error: "Invalid signature" });
      }

      try {
        if (
          event.type === "checkout.session.completed" &&
          (event.data.object as { mode?: string }).mode === "payment"
        ) {
          await chargeAlertManager.processWebhook(event);
        } else {
          await subscriptionManager.processWebhook(event);
        }
      } catch (err) {
        fastify.log.error(
          { err, eventType: event.type },
          "Webhook processing error",
        );
        // Still return 200 to prevent Stripe retries for processing errors
      }

      return reply.status(200).send({ received: true });
    },
  );

  fastify.post(
    paths.errorReporting(),
    { config: { rawBody: true } },
    async (request, reply) => {
      if (request.headers["content-type"] !== "text/plain;charset=UTF-8") {
        return reply.status(415).send();
      }

      const body =
        typeof request.body === "string"
          ? request.body
          : request.rawBody?.toString("utf-8");
      if (!body) {
        return reply.status(400).send();
      }

      let event: SentryEvent;
      try {
        event = JSON.parse(body);
      } catch {
        return reply.status(400).send();
      }

      const success = await errorReportingService.reportFrontend(event);
      if (!success) {
        return reply.status(400).send();
      }

      return reply.status(204).send();
    },
  );

  fastify.get(paths.healthz(), async (_request, reply) => {
    return reply.status(200).send({ status: "ok" });
  });
}
