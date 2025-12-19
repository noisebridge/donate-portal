import config from "~/config";
import stripe from "~/services/stripe";

export enum DonationErrorCode {
  InvalidAmount = "Please select a valid donation amount",
  SessionError = "Unable to process donation. Please try again.",
}

export interface DonateResult {
  success: true;
  checkoutUrl: string;
  sessionId: string;
}

export interface DonateError {
  success: false;
  error: DonationErrorCode;
}

export class DonationManager {
  private readonly minimumAmountDollars = 2;

  /**
   * Parse and validate a donation amount string in whole dollars.
   * Returns amount in cents or null if invalid.
   */
  parseAmountDollars(amountDollars?: string): number | null {
    const parsed = Number.parseFloat(amountDollars || "");
    if (!parsed || parsed < this.minimumAmountDollars) {
      return null;
    }
    return Math.round(parsed * 100);
  }

  /**
   * Create a one-time donation checkout session.
   * @param amountCents Donation amount
   * @param name Product name
   * @param description Product description
   */
  async donate(
    amountCents: number,
    name?: string,
    description?: string,
  ): Promise<DonateResult | DonateError> {
    if (amountCents < this.minimumAmountDollars * 100) {
      return { success: false, error: DonationErrorCode.InvalidAmount };
    }

    const baseUrl = `${config.serverProtocol}://${config.serverHost}`;

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
            unit_amount: amountCents,
          },
          quantity: 1,
        },
      ],
      mode: "payment",
      success_url: `${baseUrl}/thank-you`,
      cancel_url: `${baseUrl}/`,
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
