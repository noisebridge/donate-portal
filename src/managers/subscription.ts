import type Stripe from "stripe";
import config from "~/config";
import type { ErrorCodeKey } from "~/lib/error-codes";
import baseLogger from "~/lib/logger";
import paths from "~/lib/paths";
import * as emailManager from "~/managers/email";
import stripe from "~/services/stripe";
import type { Cents } from "~/types/cents";

export type SubscribeResult =
  | { success: true; clientSecret?: string }
  | { success: false; error: ErrorCodeKey };

export type CancelResult =
  | { success: true }
  | { success: false; error: ErrorCodeKey };

export type PortalResult =
  | { success: true; portalUrl: string }
  | { success: false; error: ErrorCodeKey };

interface SubscriptionInfo {
  customer?: Stripe.Customer | undefined;
  subscription?: Stripe.Subscription | undefined;
}

const log = baseLogger.child({ module: "subscription" });

export const MINIMUM_AMOUNT: Cents = { cents: 500 };
export const PRODUCT_ID = "monthly_donation";

/**
 * Get customer and their active or past-due subscription by email
 */
export async function get(email: string): Promise<SubscriptionInfo> {
  const customers = await stripe.customers.list({
    email,
    limit: 2,
  });
  if (customers.data.length > 1) {
    throw new Error("Multiple customers found");
  }

  const customer = customers.data[0];
  if (!customer) {
    return { customer: undefined, subscription: undefined };
  }

  const [activeSubs, pastDueSubs] = await Promise.all([
    stripe.subscriptions.list({
      customer: customer.id,
      status: "active",
      limit: 2,
    }),
    stripe.subscriptions.list({
      customer: customer.id,
      status: "past_due",
      limit: 2,
    }),
  ]);

  const subscriptions = [activeSubs.data, pastDueSubs.data].flat();
  if (subscriptions.length > 1) {
    throw new Error("Multiple active subscriptions found");
  }

  const subscription = subscriptions[0];
  if (!subscription) {
    return { customer };
  }

  return { customer, subscription };
}

/**
 * Create a new subscription or update an existing one.
 * If the customer has an existing subscription with a different amount,
 * it will be updated on the next billing cycle.
 */
export async function subscribe(
  email: string,
  amount: Cents,
): Promise<SubscribeResult> {
  if (amount.cents < MINIMUM_AMOUNT.cents) {
    return { success: false, error: "InvalidMonthlyDonationAmount" };
  }

  const { customer: existingCustomer, subscription: existingSubscription } =
    await get(email);
  const customer =
    existingCustomer ?? (await stripe.customers.create({ email }));
  if (!existingSubscription) {
    return await createSubscription(customer, amount);
  }

  return await updateSubscription(existingSubscription, amount);
}

async function createSubscription(
  customer: Stripe.Customer,
  amount: Cents,
): Promise<SubscribeResult> {
  const session = await stripe.checkout.sessions.create({
    customer: customer.id,
    mode: "subscription",
    ui_mode: "embedded_page",
    line_items: [
      {
        price_data: {
          currency: "usd",
          product: PRODUCT_ID,
          unit_amount: amount.cents,
          recurring: {
            interval: "month",
          },
        },
        quantity: 1,
      },
    ],
    return_url: `${config.baseUrl}${paths.manage({ info: "SubscriptionCreated" })}`,
  });

  if (!session.client_secret) {
    return { success: false, error: "CreateError" };
  }

  return {
    success: true,
    clientSecret: session.client_secret,
  };
}

async function updateSubscription(
  subscription: Stripe.Subscription,
  amount: Cents,
): Promise<SubscribeResult> {
  if (subscription.status === "past_due") {
    return { success: false, error: "PastDue" };
  }

  const existingAmount = subscriptionAmount(subscription);
  if (existingAmount?.cents === amount.cents) {
    return { success: false, error: "SameAmount" };
  }

  const existingItemId = subscription.items.data[0]?.id;
  if (!existingItemId) {
    return { success: false, error: "NoLineItem" };
  }

  try {
    await stripe.subscriptions.update(subscription.id, {
      items: [
        {
          id: existingItemId,
          price_data: {
            currency: "usd",
            product: PRODUCT_ID,
            unit_amount: amount.cents,
            recurring: {
              interval: "month",
            },
          },
        },
      ],
      proration_behavior: "none",
    });
  } catch (error) {
    log.error({ error }, "Failed to update subscription");
    return { success: false, error: "UpdateError" };
  }

  return { success: true };
}

/**
 * Cancel an active or past-due subscription for the given email.
 */
export async function cancel(email: string): Promise<CancelResult> {
  const { customer, subscription } = await get(email);
  if (!customer) {
    return { success: false, error: "NoCustomer" };
  }
  if (!subscription) {
    return { success: false, error: "NoSubscription" };
  }

  try {
    await stripe.subscriptions.cancel(subscription.id);
  } catch (e) {
    log.error({ error: e }, "Failed to cancel subscription");
    return { success: false, error: "CancelError" };
  }

  const amountCents = subscriptionAmount(subscription);
  const emailResult = await emailManager.sendSubscriptionCanceled(
    email,
    amountCents,
  );
  if (!emailResult.success) {
    log.error(
      { error: emailResult.error, email },
      "Failed to send subscription canceled email",
    );
  }

  return { success: true };
}

/**
 * Create a Stripe billing portal session for the customer to manage
 * their subscription, payment methods, and view invoices.
 */
export async function createPortalSession(
  email: string,
): Promise<PortalResult> {
  const { customer, subscription } = await get(email);
  if (!customer) {
    return { success: false, error: "NoCustomer" };
  }
  if (!subscription) {
    return { success: false, error: "NoSubscription" };
  }

  let session: Stripe.Response<Stripe.BillingPortal.Session> | undefined;
  try {
    session = await stripe.billingPortal.sessions.create({
      configuration: config.stripePortalConfig,
      customer: customer.id,
      return_url: `${config.baseUrl}${paths.manage()}`,
    });
  } catch (e) {
    log.error({ error: e }, "Failed to create Stripe Portal session");
    return { success: false, error: "PortalError" };
  }
  if (!session.url) {
    return { success: false, error: "PortalError" };
  }

  return { success: true, portalUrl: session.url };
}

function subscriptionAmount(
  subscription?: Partial<Stripe.Subscription>,
): Cents | undefined {
  const unit_amount = subscription?.items?.data[0]?.price?.unit_amount;
  if (!unit_amount) {
    return;
  }

  return { cents: unit_amount };
}

export async function handleInvoicePaid(event: Stripe.InvoicePaidEvent) {
  const invoice = event.data.object;
  // Only handle subscription creation invoices
  if (invoice.billing_reason !== "subscription_create") {
    return;
  }

  const email = invoice.customer_email;
  if (!email) {
    return;
  }

  const amountCents = invoice.amount_paid;
  if (!amountCents) {
    return;
  }

  const emailResult = await emailManager.sendSubscriptionWelcome(email, {
    cents: amountCents,
  });
  if (!emailResult.success) {
    log.error(
      { error: emailResult.error, email },
      "Failed to send subscription welcome email",
    );
  }
}

export async function handleSubscriptionUpdated(
  event: Stripe.CustomerSubscriptionUpdatedEvent,
) {
  const subscription = event.data.object;
  const customer =
    typeof subscription.customer === "string"
      ? await stripe.customers.retrieve(subscription.customer)
      : subscription.customer;
  if (customer.deleted || !customer.email) {
    return;
  }

  const previousAttributes = event.data.previous_attributes;
  if (changedToPastDue(subscription, previousAttributes)) {
    // Handle subscription becoming past due
    const amount = subscriptionAmount(subscription);
    const emailResult = await emailManager.sendSubscriptionPastDue(
      customer.email,
      amount,
    );
    if (!emailResult.success) {
      log.error(
        { error: emailResult.error, email: customer.email },
        "Failed to send subscription past due email",
      );
    }
  } else {
    // Handle subscription amount changes
    const previousAmount = subscriptionAmount(previousAttributes);
    if (!previousAmount) {
      return;
    }

    const currentAmount = subscriptionAmount(subscription);
    if (!currentAmount) {
      return;
    }

    if (previousAmount.cents !== currentAmount.cents) {
      const emailResult = await emailManager.sendSubscriptionUpdated(
        customer.email,
        previousAmount,
        currentAmount,
      );
      if (!emailResult.success) {
        log.error(
          { error: emailResult.error, email: customer.email },
          "Failed to send subscription updated email",
        );
      }
    }
  }
}

function changedToPastDue(
  subscription: Stripe.Subscription,
  previousAttributes?: Partial<Stripe.Subscription>,
): boolean {
  if (!previousAttributes?.status) {
    // The update did not touch status, so it cannot be a change to past_due
    return false;
  }

  if (previousAttributes.status === "past_due") {
    // Subscription was already past due
    return false;
  }

  return subscription.status === "past_due";
}
