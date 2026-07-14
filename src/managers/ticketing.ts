import type Stripe from "stripe";
import type { ErrorCodeKey } from "~/lib/error-codes";
import baseLogger from "~/lib/logger";
import { timingSafeStringEqual } from "~/lib/timing-safe-equal";
import * as emailManager from "~/managers/email";
import stripe from "~/services/stripe";
import type { Cents } from "~/types/cents";

export type PurchaseResult =
  | { success: true; clientSecret: string }
  | { success: false; error: ErrorCodeKey };

export interface TicketConfirmation {
  email: string;
}

const log = baseLogger.child({ module: "afterparty" });

/**
 * Metadata marker identifying a PaymentIntent as an afterparty ticket purchase,
 * so the webhook knows to send the ticket email rather than treating it as a
 * plain donation.
 */
export const TICKET_TYPE = "afterparty_ticket";
const EVENT_TITLE = "Noisebridge's Unofficial Open Sauce Afterparty";
export const EVENT_DESCRIPTION =
  "Noisebridge welcomes the participants of Open Sauce to come and celebrate our 20th year hacking and making in the Mission. We are an anarchist, non-profit hacker space full of makers like you. Bring your exhibits, projects, and we will provide music, food, drinks, and a great time <3";
const EVENT_LOCATION = "Noisebridge, 272 Capp St, San Francisco, CA";
const EVENT_START_COMPACT = "20260720T030000Z";
const EVENT_END_COMPACT = "20260720T090000Z";
const EVENT_START_ISO = "2026-07-20T03:00:00Z";
const EVENT_END_ISO = "2026-07-20T09:00:00Z";
export const PRODUCT_NAME = "OpenSauce Afterparty";
export const DEFAULT_PRICE: Cents = { cents: 6400 };
export const MINIMUM_PRICE: Cents = { cents: 1000 };
export const MIN_QUANTITY = 1;
export const MAX_QUANTITY = 20;

function escapeCalendarText(value: string): string {
  return value
    .replaceAll("\\", "\\\\")
    .replaceAll("\n", "\\n")
    .replaceAll(",", "\\,")
    .replaceAll(";", "\\;");
}

function foldCalendarLine(line: string): string {
  const encoder = new TextEncoder();
  const folded: string[] = [];
  let current = "";
  let limit = 75;

  for (const character of line) {
    if (encoder.encode(current + character).length > limit) {
      folded.push(current);
      current = character;
      limit = 74;
    } else {
      current += character;
    }
  }
  folded.push(current);

  return folded.join("\r\n ");
}

export function calendarEvent(): string {
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Noisebridge//Open Sauce Afterparty//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    "UID:opensauce-afterparty-2026@noisebridge.net",
    "DTSTAMP:20260101T000000Z",
    `DTSTART:${EVENT_START_COMPACT}`,
    `DTEND:${EVENT_END_COMPACT}`,
    `SUMMARY:${escapeCalendarText(EVENT_TITLE)}`,
    `LOCATION:${escapeCalendarText(EVENT_LOCATION)}`,
    `DESCRIPTION:${escapeCalendarText(EVENT_DESCRIPTION)}`,
    "END:VEVENT",
    "END:VCALENDAR",
    "",
  ]
    .map(foldCalendarLine)
    .join("\r\n");
}

function calendarUrl(baseUrl: string, params: Record<string, string>): string {
  const url = new URL(baseUrl);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }
  return url.toString();
}

export function calendarLinks() {
  const outlookParams = {
    path: "/calendar/action/compose",
    rru: "addevent",
    startdt: EVENT_START_ISO,
    enddt: EVENT_END_ISO,
    subject: EVENT_TITLE,
    body: EVENT_DESCRIPTION,
    location: EVENT_LOCATION,
  };

  return {
    google: calendarUrl("https://calendar.google.com/calendar/render", {
      action: "TEMPLATE",
      text: EVENT_TITLE,
      dates: `${EVENT_START_COMPACT}/${EVENT_END_COMPACT}`,
      details: EVENT_DESCRIPTION,
      location: EVENT_LOCATION,
      ctz: "America/Los_Angeles",
    }),
    outlook: calendarUrl(
      "https://outlook.live.com/calendar/0/deeplink/compose",
      outlookParams,
    ),
    microsoft365: calendarUrl(
      "https://outlook.office.com/calendar/0/deeplink/compose",
      outlookParams,
    ),
    yahoo: calendarUrl("https://calendar.yahoo.com/", {
      v: "60",
      title: EVENT_TITLE,
      st: EVENT_START_COMPACT,
      et: EVENT_END_COMPACT,
      desc: EVENT_DESCRIPTION,
      in_loc: EVENT_LOCATION,
    }),
  };
}

export function validateQuantity(quantity: number): boolean {
  return (
    Number.isInteger(quantity) &&
    quantity >= MIN_QUANTITY &&
    quantity <= MAX_QUANTITY
  );
}

/**
 * Create a one-time checkout for afterparty tickets. The total charge is the
 * per-ticket price multiplied by the quantity; the quantity and buyer email are
 * stashed in Stripe metadata so the ticket email can be sent once payment
 * succeeds.
 */
export async function purchase(
  pricePerTicket: Cents,
  quantity: number,
  email: string,
): Promise<PurchaseResult> {
  if (pricePerTicket.cents < MINIMUM_PRICE.cents) {
    return { success: false, error: "InvalidDonationAmount" };
  }

  if (!validateQuantity(quantity)) {
    return { success: false, error: "InvalidRequest" };
  }

  const paymentIntent = await stripe.paymentIntents.create({
    amount: pricePerTicket.cents * quantity,
    currency: "usd",
    automatic_payment_methods: { enabled: true },
    description: PRODUCT_NAME,
    metadata: {
      name: PRODUCT_NAME,
      type: TICKET_TYPE,
      quantity: String(quantity),
      unitPrice: String(pricePerTicket.cents),
      email,
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

/**
 * Whether a payment intent is an afterparty ticket purchase.
 */
export function isTicketPurchase(paymentIntent: Stripe.PaymentIntent): boolean {
  return paymentIntent.metadata?.["type"] === TICKET_TYPE;
}

/**
 * Resolve the buyer details for a completed ticket purchase from the identifiers
 * Stripe appends to the checkout return URL. The client secret gates access:
 * only someone who actually completed this specific checkout holds it, so we
 * compare it against the PaymentIntent before trusting the request. Returns null
 * for anything that isn't a verified afterparty ticket purchase, so the caller
 * can fall back to generic copy.
 */
export async function getPurchaseConfirmation(
  paymentIntentId: string | undefined,
  clientSecret: string | undefined,
): Promise<TicketConfirmation | null> {
  if (!paymentIntentId || !clientSecret) {
    return null;
  }

  let paymentIntent: Stripe.PaymentIntent;
  try {
    paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
  } catch (err) {
    log.warn(
      { err, id: paymentIntentId },
      "Failed to retrieve payment intent for ticket confirmation",
    );
    return null;
  }

  if (
    !paymentIntent.client_secret ||
    !timingSafeStringEqual(paymentIntent.client_secret, clientSecret)
  ) {
    return null;
  }

  if (!isTicketPurchase(paymentIntent)) {
    return null;
  }

  const email = paymentIntent.metadata["email"];
  if (!email) {
    return null;
  }

  return { email };
}

/**
 * Send the ticket confirmation email for a successful afterparty purchase.
 * No-op for payment intents that aren't afterparty tickets.
 */
export async function handlePaymentSuccess(
  event: Stripe.PaymentIntentSucceededEvent,
) {
  const paymentIntent = event.data.object;
  if (!isTicketPurchase(paymentIntent)) {
    return;
  }

  const email = paymentIntent.metadata["email"];
  if (!email) {
    log.error(
      { id: paymentIntent.id },
      "Afterparty ticket purchase is missing an email address",
    );
    return;
  }

  const quantity = Number.parseInt(
    paymentIntent.metadata["quantity"] ?? "",
    10,
  );
  if (!validateQuantity(quantity)) {
    log.error(
      { id: paymentIntent.id, quantity: paymentIntent.metadata["quantity"] },
      "Afterparty ticket purchase has an invalid quantity",
    );
    return;
  }

  const amount: Cents = { cents: paymentIntent.amount ?? 0 };
  const result = await emailManager.sendAfterpartyTicket(
    email,
    quantity,
    amount,
  );
  if (!result.success) {
    log.error(
      { error: result.error, email },
      "Failed to send afterparty ticket email",
    );
  }
}
