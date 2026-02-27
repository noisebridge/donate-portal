import { z } from "zod";

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
export type AmountFormData =
  | { "amount-dollars": "custom"; "custom-amount": string }
  | { "amount-dollars": string };

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
    return amountFormData["custom-amount"] as string;
  }
  return amountFormData["amount-dollars"];
}

/**
 * Tagged object to make financial mistakes less common.
 */
export interface Cents {
  cents: number;
}

export function parseToCents(
  amountFormData: string | AmountFormData,
): Cents | null {
  const parsedDollars = Number.parseFloat(
    typeof amountFormData === "string"
      ? amountFormData
      : getAmount(amountFormData),
  );
  if (Number.isNaN(parsedDollars)) {
    return null;
  }
  if (parsedDollars <= 0) {
    return null;
  }

  return { cents: Math.round(parsedDollars * 100) };
}

/**
 * Format cents as dollar amount.
 */
export function formatAmount(amount: Cents): string {
  return `$${(amount.cents / 100).toFixed(2)}`;
}
