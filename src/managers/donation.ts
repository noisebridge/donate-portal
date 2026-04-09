import stripe from "~/services/stripe";
import type { Cents } from "~/types/cents";
import { GENERAL_DONATION, NAME_REMAP } from "./charge-alert";

export enum DonationErrorCode {
  InvalidAmount = "Please select a valid donation amount",
  SessionError = "Unable to process donation. Please try again.",
}

export type DonateResult =
  | { success: true; clientSecret: string }
  | { success: false; error: DonationErrorCode };

export class DonationManager {
  static readonly minimumAmount: Cents = { cents: 200 };
  static readonly defaultName = "Donation to Noisebridge";
  static readonly maxNameLength = 40;
  static readonly defaultDescription = "Support our hackerspace community";
  static readonly maxDescriptionLength = 80;

  /**
   * Whether a donation product is a general donation.
   * @param name Donation product name.
   */
  isGeneral(name?: string) {
    if (!name) {
      return true;
    }

    return NAME_REMAP[name] === GENERAL_DONATION;
  }

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

    const paymentIntent = await stripe.paymentIntents.create({
      amount: amount.cents,
      currency: "usd",
      automatic_payment_methods: { enabled: true },
      description: name || DonationManager.defaultName,
      metadata: {
        name: name || DonationManager.defaultName,
        description: description || DonationManager.defaultDescription,
      },
    });
    if (!paymentIntent.client_secret) {
      return { success: false, error: DonationErrorCode.SessionError };
    }

    return {
      success: true,
      clientSecret: paymentIntent.client_secret,
    };
  }
}

const donationManager = new DonationManager();
export default donationManager;
