import type { ErrorCodeKey } from "~/lib/error-codes";
import stripe from "~/services/stripe";
import type { Cents } from "~/types/cents";

export type DonateResult =
  | { success: true; clientSecret: string }
  | { success: false; error: ErrorCodeKey };

export const MINIMUM_AMOUNT: Cents = { cents: 200 };
export const DEFAULT_NAME = "Donation to Noisebridge";
export const MAX_NAME_LENGTH = 40;
export const DEFAULT_DESCRIPTION = "Support our hackerspace community";
export const MAX_DESCRIPTION_LENGTH = 80;

export const GENERAL_DONATION = "General Donation";
export const NAME_REMAP: Record<string, string> = {
  [DEFAULT_NAME]: GENERAL_DONATION,
  "Support Us": GENERAL_DONATION,
};

export function validateParams(name?: string, description?: string): boolean {
  if (name && name.length > MAX_NAME_LENGTH) {
    return false;
  }

  if (description && description.length > MAX_DESCRIPTION_LENGTH) {
    return false;
  }

  return true;
}

export function isGeneral(name?: string) {
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
export async function donate(
  amount: Cents,
  name?: string,
  description?: string,
): Promise<DonateResult> {
  if (amount.cents < MINIMUM_AMOUNT.cents) {
    return { success: false, error: "InvalidDonationAmount" };
  }

  const paymentIntent = await stripe.paymentIntents.create({
    amount: amount.cents,
    currency: "usd",
    automatic_payment_methods: { enabled: true },
    description: name || DEFAULT_NAME,
    metadata: {
      name: name || DEFAULT_NAME,
      description: description || DEFAULT_DESCRIPTION,
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
