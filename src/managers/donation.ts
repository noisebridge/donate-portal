import type { ErrorCodeKey } from "~/error-codes";
import stripe from "~/services/stripe";
import type { Cents } from "~/types/cents";

export type DonateResult =
  | { success: true; clientSecret: string }
  | { success: false; error: ErrorCodeKey };

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
      return { success: false, error: "InvalidDonationAmount" };
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
      return { success: false, error: "SessionError" };
    }

    return {
      success: true,
      clientSecret: paymentIntent.client_secret,
    };
  }
}

export const GENERAL_DONATION = "General Donation";
export const NAME_REMAP: Record<string, string> = {
  [DonationManager.defaultName]: GENERAL_DONATION,
  "Support Us": GENERAL_DONATION,
};

const donationManager = new DonationManager();
export default donationManager;
