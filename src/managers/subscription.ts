import type Stripe from "stripe";
import config from "~/config";
import type { Cents } from "~/money";
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
}

export interface SubscribeResult {
  success: true;
  checkoutUrl: string;
  sessionId: string;
  customerId: string;
}

export interface SubscribeError {
  success: false;
  error: SubscriptionErrorCode;
}

export interface CancelResult {
  success: true;
  subscriptionId: string;
  customerId: string;
}

export interface CancelError {
  success: false;
  error: SubscriptionErrorCode;
}

export interface CustomerSubscriptionInfo {
  customer?: Stripe.Customer | undefined;
  subscription?: Stripe.Subscription | undefined;
}

export class SubscriptionManager {
  private readonly minimumAmount: Cents = { cents: 500 };
  private readonly productId = "monthly_donation";

  /**
   * Get customer and their active subscription by email
   */
  async getCustomerSubscription(
    email: string,
  ): Promise<CustomerSubscriptionInfo> {
    const customers = await stripe.customers.list({
      email,
      limit: 1,
    });

    const customer = customers.data[0];
    if (!customer) {
      return { customer: undefined, subscription: undefined };
    }

    const subscriptions = await stripe.subscriptions.list({
      customer: customer.id,
      status: "active",
      limit: 1,
    });

    return {
      customer,
      subscription: subscriptions.data[0],
    };
  }

  /**
   * Create a new subscription or change an existing one.
   * If the customer has an existing subscription with a different amount,
   * it will be canceled first.
   */
  async subscribe(
    email: string,
    amount: Cents,
  ): Promise<SubscribeResult | SubscribeError> {
    const { customer, subscription: existingSubscription } =
      await this.getCustomerSubscription(email);
    if (!customer) {
      return { success: false, error: SubscriptionErrorCode.NoCustomer };
    }

    if (amount.cents < this.minimumAmount.cents) {
      return { success: false, error: SubscriptionErrorCode.InvalidAmount };
    }

    // Check if trying to subscribe with same amount
    if (existingSubscription) {
      const existingAmount =
        existingSubscription.items.data[0]?.price?.unit_amount;
      if (existingAmount === amount.cents) {
        return { success: false, error: SubscriptionErrorCode.SameAmount };
      }

      const existingItemId = existingSubscription.items.data[0]?.id;
      if (!existingItemId) {
        return { success: false, error: SubscriptionErrorCode.NoLineItem };
      }

      // Update subscription with new price for monthly_donation product.
    }

    const session = await stripe.checkout.sessions.create({
      customer: customer.id,
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
            unit_amount: amount.cents,
            recurring: {
              interval: "month",
            },
          },
          quantity: 1,
        },
      ],
      success_url: `${config.serverProtocol}://${config.serverHost}/manage`,
      cancel_url: `${config.serverProtocol}://${config.serverHost}/manage`,
    });

    const checkoutUrl = session.url;
    if (!checkoutUrl) {
      throw new Error("Failed to create checkout session");
    }

    return {
      success: true,
      checkoutUrl,
      sessionId: session.id,
      customerId: customer.id,
    };
  }

  /**
   * Cancel an active subscription for the given email.
   * Applies prorated refund.
   */
  async cancel(email: string): Promise<CancelResult | CancelError> {
    const { customer, subscription } =
      await this.getCustomerSubscription(email);

    if (!customer) {
      return { success: false, error: SubscriptionErrorCode.NoCustomer };
    }

    if (!subscription) {
      return { success: false, error: SubscriptionErrorCode.NoSubscription };
    }

    // Get the amount before canceling
    const amountCents = subscription.items.data[0]?.price?.unit_amount;

    await stripe.subscriptions.cancel(subscription.id, {
      prorate: true,
      invoice_now: true,
    });

    // Send cancellation email
    if (amountCents) {
      await emailManager.sendSubscriptionCanceledEmail(email, amountCents);
    }

    return {
      success: true,
      subscriptionId: subscription.id,
      customerId: customer.id,
    };
  }
}

const subscriptionManager = new SubscriptionManager();
export default subscriptionManager;
