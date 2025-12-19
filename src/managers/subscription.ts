import type Stripe from "stripe";
import config from "~/config";
import stripe from "~/services/stripe";
import emailManager from "./email";

export enum SubscriptionErrorCode {
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
  canceledExisting: boolean;
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
    amountCents: number,
  ): Promise<SubscribeResult | SubscribeError> {
    const { customer, subscription: existingSubscription } =
      await this.getCustomerSubscription(email);
    if (!customer) {
      return { success: false, error: SubscriptionErrorCode.NoCustomer };
    }

    // Check if trying to subscribe with same amount
    if (existingSubscription) {
      const existingAmount =
        existingSubscription.items.data[0]?.price?.unit_amount;
      if (existingAmount === amountCents) {
        return { success: false, error: SubscriptionErrorCode.SameAmount };
      }

      const existingItemId = existingSubscription.items.data[0]?.id;
      if (!existingItemId) {
        return { success: false, error: SubscriptionErrorCode.NoLineItem };
      }

      // await stripe.subscriptions.update(existingSubscription.id, {
      //   proration_behavior: "always_invoice",
      //   items: [
      //     {
      //       id: existingItemId,
      //       ...this.subscriptionItem(amountCents),
      //     },
      //   ],
      // });
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
            unit_amount: amountCents,
            recurring: {
              interval: "month",
            },
          },
          quantity: 1,
        },
      ],
      success_url: `${config.serverProtocol}://${config.serverHost}/manage?`,
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
      canceledExisting: !!existingSubscription,
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

  // private subscriptionItem(amountCents: number): Stripe.Checkout.SessionCreateParams.LineItem {
  //   return {
  //     price_data: {
  //       currency: "usd",
  //       product_data: {
  //         name: "Monthly Donation to Noisebridge",
  //         description: "Support our hackerspace community",
  //       },
  //       unit_amount: amountCents,
  //       recurring: {
  //         interval: "month",
  //       },
  //     },
  //   };
  // }
}

const subscriptionManager = new SubscriptionManager();
export default subscriptionManager;
