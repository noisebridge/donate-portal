import { z } from "zod";
import type { Cents } from "~/types/cents";

const numericString = z.string().refine((s) => !Number.isNaN(parseFloat(s)));

const amountFormDataSchema = z.union([
  z.object({
    "amount-dollars": z.literal("custom"),
    "custom-amount": numericString,
  }),
  z.object({
    "amount-dollars": numericString,
  }),
]);
/**
 * HTML form data that can either be a preset dollar amount or one the user
 * typed in manually.
 */
export type AmountFormData = z.infer<typeof amountFormDataSchema>;

export function validateAmountFormData(
  input: unknown,
): input is AmountFormData {
  return amountFormDataSchema.safeParse(input).success;
}

/**
 * Get the string representation of a dollar amount from an `AmountFormData`.
 */
function getAmount(amountFormData: AmountFormData) {
  if (
    amountFormData["amount-dollars"] === "custom" &&
    "custom-amount" in amountFormData
  ) {
    return amountFormData["custom-amount"];
  }

  return amountFormData["amount-dollars"];
}

/**
 * Largest amount Stripe accepts for a single USD charge ($999,999.99).
 */
const STRIPE_MAX_CENTS = 99_999_999;

export function parseToCents(
  amountFormData: string | AmountFormData,
): Cents | null {
  const parsedDollars = Number.parseFloat(
    typeof amountFormData === "string"
      ? amountFormData
      : getAmount(amountFormData),
  );
  if (!Number.isFinite(parsedDollars)) {
    return null;
  }
  if (parsedDollars <= 0) {
    return null;
  }

  const cents = Math.round(parsedDollars * 100);
  if (cents > STRIPE_MAX_CENTS) {
    return null;
  }

  return { cents };
}

/**
 * Format cents as dollar amount.
 */
export function formatAmount(amount: Cents): string {
  return `$${(amount.cents / 100).toFixed(2)}`;
}
