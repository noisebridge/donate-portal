// biome-ignore lint/correctness/noUnusedImports: Html is used by JSX
import Html from "@kitajs/html";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import type Stripe from "stripe";
import config from "~/config";
import { magicLinkEmail } from "~/emails/magic-link";
import { CookieName, cookies, getRandomState } from "~/managers/auth";
import magicLinkManager from "~/managers/magic-link";
import githubOAuth from "~/services/github";
import googleOAuth from "~/services/google";
import resend from "~/services/resend";
import stripe from "~/services/stripe";
import { AuthPage } from "~/views/auth";
import { AuthEmailPage } from "~/views/auth/email";
import { IndexPage } from "~/views/index";
import { ManagePage } from "~/views/manage";
import { ThankYouPage } from "~/views/thank-you";
import { ErrorPage } from "./views/error";

const paths = {
  index: (error?: string) =>
    error ? `/?error=${encodeURIComponent(error)}` : `/`,
  signIn: (error?: string) =>
    error ? `/auth?error=${encodeURIComponent(error)}` : `/auth`,
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
  StripeSessionError = "Unable to process donation. Please try again.",
  InvalidMonthlyDonationAmount = "Please select a valid donation amount",
  SameMontlyDonationAmount = "Select a different donation amount",
  DonationCreateError = "Unable to create monthly donation. Please try again.",
  DonationCancelError = "Unable to cancel monthly donation. Please try again.",
  NoActiveDonation = "No active monthly donation found to cancel",
}

export function errorRoute(fastify: FastifyInstance): Parameters<FastifyInstance["setErrorHandler"]>[0] {
  return (error, request, reply) => {
    fastify.log.error(
      {
        err: error,
        url: request.url,
        method: request.method,
      },
      "Unhandled error in route",
    );

    reply.status(500).html(
      <ErrorPage
        isAuthenticated={isAuthenticated(request, reply)}
        error={error instanceof Error ? error : new Error(`Unknown error: ${error}`)}
      />
    );
  };
};

function isAuthenticated(
  request: FastifyRequest,
  reply: FastifyReply,
): boolean {
  return cookies[CookieName.UserSession](request, reply).valid();
}

function parseDonationAmount(amount?: string) {
  const minimumAmount = 2; // dollars

  const parsed = Number.parseFloat(amount || "");
  if (!parsed || parsed < minimumAmount) {
    return null;
  }

  return Math.round(parsed * 100); // Convert to cents
}

function parseSubscriptionAmount(amount?: string) {
  const minimumAmount = 5; // dollars per month

  const parsed = Number.parseFloat(amount || "");
  if (!parsed || parsed < minimumAmount) {
    return null;
  }

  return Math.round(parsed * 100); // Convert to cents
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
    const error = request.query.error;
    return reply.html(
      <AuthPage
        isAuthenticated={isAuthenticated(request, reply)}
        error={error}
      />,
    );
  });

  fastify.get("/auth/github/start", async (request, reply) => {
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

  fastify.get("/auth/google/start", async (request, reply) => {
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
  }>("/auth/email", async (request, reply) => {
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

    const magicLinkUrl = magicLinkManager.generateMagicLinkUrl(email);
    const emailHtml = magicLinkEmail({
      email,
      magicLinkUrl,
    });
    const response = await resend.emails.send({
      from: "Noisebridge <onboarding@resend.dev>",
      to: [email],
      subject: "Sign in to donate.noisebridge.net",
      html: emailHtml,
    });
    request.log.info(response);
    fastify.log.info({ email }, "Magic link email sent");

    return reply.redirect(`/auth/email?email=${encodeURIComponent(email)}`);
  });

  fastify.get<{
    Querystring: { email?: string };
  }>("/auth/email", async (request, reply) => {
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

    let stripeCustomer: Stripe.Customer | undefined;
    let stripeSubscription: Stripe.Subscription | undefined;

    try {
      const customers = await stripe.customers.list({
        email: sessionData.email,
        limit: 1,
      });
      stripeCustomer = customers.data[0];

      if (stripeCustomer) {
        const subscriptions = await stripe.subscriptions.list({
          customer: stripeCustomer.id,
          status: "active",
          limit: 1,
        });

        if (subscriptions.data.length > 0) {
          stripeSubscription = subscriptions.data[0];

          if (subscriptions.data.length > 1) {
            fastify.log.warn(
              {
                customerId: stripeCustomer.id,
                count: subscriptions.data.length,
              },
              "Customer has multiple active subscriptions, using first",
            );
          }
        }
      }
    } catch (error) {
      fastify.log.error(
        error,
        "Error fetching Stripe customer/subscription data",
      );
    }

    const error = request.query.error;
    return reply.html(
      <ManagePage
        customer={stripeCustomer}
        subscription={stripeSubscription}
        error={error}
      />,
    );
  });

  fastify.post<{
    Body: { amount?: string; "custom-amount"?: string };
  }>("/donate", async (request, reply) => {
    const { amount, "custom-amount": customAmount } = request.body || {};

    const amountCents = parseDonationAmount(
      amount === "custom" ? customAmount : amount,
    );
    if (amountCents === null) {
      reply.redirect(paths.index(ErrorCode.InvalidDonationAmount));
      return;
    }

    // Create a Stripe Checkout Session for one-time payment
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: {
              name: "Donation to Noisebridge",
              description: "Support our hackerspace community",
            },
            unit_amount: amountCents,
          },
          quantity: 1,
        },
      ],
      mode: "payment",
      success_url: `${request.protocol}://${config.serverHost}/thank-you`,
      cancel_url: `${request.protocol}://${config.serverHost}/`,
    });

    if (!session.url) {
      fastify.log.error("Stripe session created but no URL returned");
      return reply.redirect(paths.index(ErrorCode.StripeSessionError));
    }

    fastify.log.info(
      { amount: amountCents, sessionId: session.id },
      "Stripe checkout session created for donation",
    );

    return reply.redirect(session.url);
  });

  fastify.post<{
    Body: { tier?: string; customAmount?: string };
  }>("/subscribe", async (request, reply) => {
    const sessionCookie = cookies[CookieName.UserSession](request, reply);
    const sessionData = sessionCookie.value;
    if (!sessionData) {
      fastify.log.warn("Unauthenticated subscription attempt");
      return reply.redirect(paths.signIn());
    }

    const { tier, customAmount } = request.body || {};
    const amountCents = parseSubscriptionAmount(
      tier === "custom" ? customAmount : tier,
    );

    if (amountCents === null) {
      fastify.log.warn(
        { tier, customAmount, email: sessionData.email },
        "Invalid subscription amount",
      );
      return reply.redirect(
        paths.manage(ErrorCode.InvalidMonthlyDonationAmount),
      );
    }

    try {
      let customerId: string | undefined;
      let existingSubscription: Stripe.Subscription | undefined;

      const customers = await stripe.customers.list({
        email: sessionData.email,
        limit: 1,
      });

      if (customers.data.length > 0) {
        const customer = customers.data[0];
        if (customer) {
          customerId = customer.id;

          // Check if customer has active subscription
          const subscriptions = await stripe.subscriptions.list({
            customer: customerId,
            status: "active",
            limit: 1,
          });

          if (subscriptions.data.length > 0) {
            existingSubscription = subscriptions.data[0];
          }
        }
      }

      if (existingSubscription) {
        const existingAmount = existingSubscription.items.data[0]?.price?.unit_amount;
        if (existingAmount === amountCents) {
          reply.redirect(paths.manage(ErrorCode.SameMontlyDonationAmount));
          return;
        }

        await stripe.subscriptions.cancel(existingSubscription.id);
        fastify.log.info(
          {
            subscriptionId: existingSubscription.id,
            customerId,
            email: sessionData.email,
          },
          "Canceled existing subscription before creating new one",
        );
      }

      const sessionConfig: Stripe.Checkout.SessionCreateParams = {
        mode: "subscription",
        payment_method_types: ["card"],
        line_items: [
          {
            price_data: {
              currency: "usd",
              product_data: {
                name: "Monthly Donation to Noisebridge",
                description: "Support our hackerspace community",
              },
              unit_amount: amountCents,
              recurring: {
                interval: "month",
              },
            },
            quantity: 1,
          },
        ],
        success_url: `${request.protocol}://${config.serverHost}/manage`,
        cancel_url: `${request.protocol}://${config.serverHost}/manage`,
      };

      // Link to existing customer or let Stripe create one
      if (customerId) {
        sessionConfig.customer = customerId;
      } else {
        sessionConfig.customer_email = sessionData.email;
      }

      const session = await stripe.checkout.sessions.create(sessionConfig);

      if (!session.url) {
        fastify.log.error(
          "Stripe subscription session created but no URL returned",
        );
        return reply.redirect(paths.manage(ErrorCode.DonationCreateError));
      }

      fastify.log.info(
        {
          amount: amountCents,
          email: sessionData.email,
          sessionId: session.id,
          existingSubscription: !!existingSubscription,
        },
        "Stripe subscription checkout session created",
      );

      return reply.redirect(session.url);
    } catch (error) {
      fastify.log.error(
        { error, email: sessionData.email, amount: amountCents },
        "Error creating subscription checkout session",
      );
      return reply.redirect(paths.manage(ErrorCode.DonationCreateError));
    }
  });

  fastify.post("/cancel", async (request, reply) => {
    const sessionCookie = cookies[CookieName.UserSession](request, reply);
    const sessionData = sessionCookie.value;
    if (!sessionData) {
      fastify.log.warn("Unauthenticated cancel attempt");
      return reply.redirect(paths.signIn());
    }

    try {
      const customers = await stripe.customers.list({
        email: sessionData.email,
        limit: 1,
      });

      if (customers.data.length === 0) {
        fastify.log.warn(
          { email: sessionData.email },
          "No Stripe customer found for cancel request",
        );
        return reply.redirect(paths.manage(ErrorCode.NoActiveDonation));
      }

      const customer = customers.data[0];
      if (!customer) {
        fastify.log.warn(
          { email: sessionData.email },
          "No Stripe customer found for cancel request",
        );
        return reply.redirect(paths.manage(ErrorCode.NoActiveDonation));
      }

      const subscriptions = await stripe.subscriptions.list({
        customer: customer.id,
        status: "active",
        limit: 1,
      });

      if (subscriptions.data.length === 0) {
        fastify.log.warn(
          { customerId: customer.id, email: sessionData.email },
          "No active subscription found for cancel request",
        );
        return reply.redirect(paths.manage(ErrorCode.NoActiveDonation));
      }

      const subscription = subscriptions.data[0];
      if (!subscription) {
        fastify.log.warn(
          { customerId: customer.id, email: sessionData.email },
          "No active subscription found for cancel request",
        );
        return reply.redirect(paths.manage(ErrorCode.NoActiveDonation));
      }

      await stripe.subscriptions.cancel(subscription.id, {
        prorate: true,
        invoice_now: true,
      });

      fastify.log.info(
        {
          subscriptionId: subscription.id,
          customerId: customer.id,
          email: sessionData.email,
        },
        "Subscription canceled with prorated refund",
      );

      return reply.redirect(paths.manage());
    } catch (error) {
      fastify.log.error(
        { error, email: sessionData.email },
        "Error canceling subscription",
      );
      return reply.redirect(paths.manage(ErrorCode.DonationCancelError));
    }
  });

  fastify.get("/thank-you", async (request, reply) => {
    return reply.html(
      <ThankYouPage isAuthenticated={isAuthenticated(request, reply)} />,
    );
  });
}
