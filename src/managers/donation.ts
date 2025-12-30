import config from "~/config";
import type { Cents } from "~/money";
import paths from "~/paths";
import stripe from "~/services/stripe";

export enum DonationErrorCode {
  InvalidAmount = "Please select a valid donation amount",
  SessionError = "Unable to process donation. Please try again.",
}

export type DonateResult =
  | { success: true; checkoutUrl: string; sessionId: string }
  | { success: false; error: DonationErrorCode };

export class DonationManager {
  static readonly minimumAmount: Cents = { cents: 200 };

  /**
   * Create a one-time donation checkout session.
   * @param amountCents Donation amount
   * @param name Product name
   * @param description Product description
   */
  async donate(
    amount: Cents,
    name?: string,
    description?: string,
  ): Promise<DonateResult> {
    if (amount.cents < DonationManager.minimumAmount.cents) {
      return { success: false, error: DonationErrorCode.InvalidAmount };
    }

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: {
              name: name ?? "Donation to Noisebridge",
              description: description ?? "Support our hackerspace community",
            },
            unit_amount: amount.cents,
          },
          quantity: 1,
        },
      ],
      mode: "payment",
      success_url: `${config.baseUrl}${paths.thankYou()}`,
      cancel_url: `${config.baseUrl}${paths.index()}`,
    });

    if (!session.url) {
      return { success: false, error: DonationErrorCode.SessionError };
    }

    return {
      success: true,
      checkoutUrl: session.url,
      sessionId: session.id,
    };
  }
}

const donationManager = new DonationManager();
export default donationManager;
