import type Stripe from "stripe";
import config from "~/config";
import { baseLogger } from "~/logger";
import type { Cents } from "~/money";
import paths from "~/paths";
import { InfoCode } from "~/routes";
import stripe from "~/services/stripe";
import emailManager from "./email";

export enum SubscriptionErrorCode {
  InvalidAmount = "Please select a valid donation amount",
  SameAmount = "Select a different donation amount",
  NoCustomer = "No Stripe customer found",
  NoSubscription = "No active monthly donation found to cancel",
  NoLineItem = "No line items in your active subscription",
  CreateError = "Unable to create monthly donation. Please try again.",
  CancelError = "Unable to cancel monthly donation. Please try again.",
  UpdateError = "Unable to update donation amount. Please try again.",
}

export type SubscribeResult =
  | { success: true; checkoutUrl?: string }
  | { success: false; error: SubscriptionErrorCode };

export type CancelResult =
  | { success: true }
  | { success: false; error: string };

export type PortalResult =
  | { success: true; portalUrl: string }
  | { success: false; error: string };

export interface SubscriptionInfo {
  customer?: Stripe.Customer | undefined;
  subscription?: Stripe.Subscription | undefined;
  migrated?: boolean;
}

export class SubscriptionManager {
  static readonly log = baseLogger.child({ class: "SubscriptionManager" });
  static readonly minimumAmount: Cents = { cents: 500 };
  static readonly productId = "monthly_donation";

  /**
   * Get customer and their active subscription by email
   */
  async getSubscription(email: string): Promise<SubscriptionInfo> {
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

    const migrated = this.migratedSubscription(subscription);

    return { customer, subscription, migrated };
  }

  /**
   * Whether a subscription has been migrated from ones made by the previous
   * Python app.
   */
  private migratedSubscription(subscription: Stripe.Subscription) {
    const items = subscription.items.data;
    if (items.length !== 1) {
      return false;
    }

    const item = items[0];
    if (item?.price?.product !== SubscriptionManager.productId) {
      return false;
    }

    return true;
  }

  /**
   * Create a new subscription or update an existing one.
   * If the customer has an existing subscription with a different amount,
   * it will be updated with prorated billing.
   */
  async subscribe(email: string, amount: Cents): Promise<SubscribeResult> {
    if (amount.cents < SubscriptionManager.minimumAmount.cents) {
      return { success: false, error: SubscriptionErrorCode.InvalidAmount };
    }

    const { customer: existingCustomer, subscription: existingSubscription } =
      await this.getSubscription(email);
    const customer =
      existingCustomer ?? (await stripe.customers.create({ email }));
    if (!existingSubscription) {
      return await this.createSubscription(customer, amount);
    }

    return await this.updateSubscription(existingSubscription, amount);
  }

  private async createSubscription(
    customer: Stripe.Customer,
    amount: Cents,
  ): Promise<SubscribeResult> {
    const session = await stripe.checkout.sessions.create({
      customer: customer.id,
      mode: "subscription",
      payment_method_types: ["card"],
      line_items: [
        {
          price_data: {
            currency: "usd",
            product: SubscriptionManager.productId,
            unit_amount: amount.cents,
            recurring: {
              interval: "month",
            },
          },
          quantity: 1,
        },
      ],
      success_url: `${config.baseUrl}${paths.manage({ info: InfoCode.SubscriptionCreated })}`,
      cancel_url: `${config.baseUrl}${paths.manage()}`,
    });

    const checkoutUrl = session.url;
    if (!checkoutUrl) {
      return { success: false, error: SubscriptionErrorCode.CreateError };
    }

    return {
      success: true,
      checkoutUrl,
    };
  }

  private async updateSubscription(
    subscription: Stripe.Subscription,
    amount: Cents,
  ): Promise<SubscribeResult> {
    const existingAmount = this.subscriptionAmount(subscription);
    if (existingAmount?.cents === amount.cents) {
      return { success: false, error: SubscriptionErrorCode.SameAmount };
    }

    const existingItemId = subscription.items.data[0]?.id;
    if (!existingItemId) {
      return { success: false, error: SubscriptionErrorCode.NoLineItem };
    }

    try {
      await stripe.subscriptions.update(subscription.id, {
        items: [
          {
            id: existingItemId,
            price_data: {
              currency: "usd",
              product: SubscriptionManager.productId,
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
      SubscriptionManager.log.error({ error }, "Failed to update subscription");
      return { success: false, error: SubscriptionErrorCode.UpdateError };
    }

    return { success: true };
  }

  /**
   * Cancel an active subscription for the given email.
   * Issues a prorated refund to the original payment method.
   */
  async cancel(email: string): Promise<CancelResult> {
    const { customer, subscription } = await this.getSubscription(email);
    if (!customer) {
      return { success: false, error: SubscriptionErrorCode.NoCustomer };
    }
    if (!subscription) {
      return { success: false, error: SubscriptionErrorCode.NoSubscription };
    }

    await stripe.subscriptions.cancel(subscription.id);

    const amountCents = this.subscriptionAmount(subscription);
    await emailManager.sendSubscriptionCanceledEmail(email, amountCents);

    return { success: true };
  }

  /**
   * Create a Stripe billing portal session for the customer to manage
   * their subscription, payment methods, and view invoices.
   */
  async createPortalSession(email: string): Promise<PortalResult> {
    const { customer, subscription } = await this.getSubscription(email);
    if (!customer) {
      return { success: false, error: SubscriptionErrorCode.NoCustomer };
    }
    if (!subscription) {
      return { success: false, error: SubscriptionErrorCode.NoSubscription };
    }

    const session = await stripe.billingPortal.sessions.create({
      configuration: config.stripePortalConfig,
      customer: customer.id,
      return_url: `${config.baseUrl}${paths.manage()}`,
    });

    if (!session.url) {
      return {
        success: false,
        error: "Unable to create billing portal session",
      };
    }

    return { success: true, portalUrl: session.url };
  }

  /**
   * Process Stripe webhook events for subscriptions.
   */
  async processWebhook(event: Stripe.Event) {
    switch (event.type) {
      case "invoice.paid":
        await this.handleInvoicePaid(event.data.object);
        break;
      case "customer.subscription.updated":
        await this.handleSubscriptionUpdated(
          event.data.object,
          event.data.previous_attributes,
        );
        break;
    }
  }

  private subscriptionAmount(
    subscription?: Partial<Stripe.Subscription>,
  ): Cents | undefined {
    const unit_amount = subscription?.items?.data[0]?.price?.unit_amount;
    if (!unit_amount) {
      return;
    }

    return { cents: unit_amount };
  }

  private async handleInvoicePaid(invoice: Stripe.Invoice) {
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

    await emailManager.sendSubscriptionWelcomeEmail(email, {
      cents: amountCents,
    });
  }

  private async handleSubscriptionUpdated(
    subscription: Stripe.Subscription,
    previousAttributes?: Partial<Stripe.Subscription>,
  ) {
    const customer =
      typeof subscription.customer === "string"
        ? await stripe.customers.retrieve(subscription.customer)
        : subscription.customer;
    if (customer.deleted || !customer.email) {
      return;
    }

    if (this.changedToPastDue(subscription, previousAttributes)) {
      // Handle subscription becoming past due
      const amount = this.subscriptionAmount(subscription);
      await emailManager.sendSubscriptionPastDueEmail(customer.email, amount);
    } else {
      // Handle subscription amount changes
      const previousAmount = this.subscriptionAmount(previousAttributes);
      if (!previousAmount) {
        return;
      }

      const currentAmount = this.subscriptionAmount(subscription);
      if (!currentAmount) {
        return;
      }

      if (previousAmount.cents !== currentAmount.cents) {
        await emailManager.sendSubscriptionUpdatedEmail(
          customer.email,
          previousAmount,
          currentAmount,
        );
      }
    }
  }

  private changedToPastDue(
    subscription: Stripe.Subscription,
    previousAttributes?: Partial<Stripe.Subscription>,
  ): boolean {
    if (!previousAttributes?.status) {
      // Newly created - no previous attributes available
      return false;
    }

    if (previousAttributes.status === "past_due") {
      // Subscription was already past due
      return false;
    }

    return subscription.status === "past_due";
  }
}

const subscriptionManager = new SubscriptionManager();
export default subscriptionManager;
