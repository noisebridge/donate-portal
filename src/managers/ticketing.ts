import type Stripe from "stripe";
import config from "~/config";
import type { ErrorCodeKey } from "~/lib/error-codes";
import baseLogger from "~/lib/logger";
import { timingSafeStringEqual } from "~/lib/timing-safe-equal";
import * as emailManager from "~/managers/email";
import stripe from "~/services/stripe";
import type { Cents } from "~/types/cents";

export type PurchaseResult =
  | { success: true; clientSecret: string }
  | { success: true; free: true }
  | { success: false; error: ErrorCodeKey };

export interface TicketConfirmation {
  email: string;
}

export interface TicketAvailability {
  capacity: number;
  claimed: number;
  confirmed: number;
  remaining: number;
  raised: Cents;
}

const log = baseLogger.child({ module: "afterparty" });

/**
 * Metadata marker identifying a PaymentIntent as an afterparty ticket purchase,
 * so the webhook knows to send the ticket email rather than treating it as a
 * plain donation.
 */
export const TICKET_TYPE = "afterparty_ticket";
const REGISTRATION_TYPE = "afterparty_ticket_registration";
const REGISTRATION_PENDING = "pending";
const REGISTRATION_CONFIRMED = "confirmed";
const PENDING_RESERVATION_SECONDS = 30 * 60;
const REGISTRATION_OPENED_AT = Math.floor(Date.UTC(2026, 6, 1) / 1000);
const EVENT_TITLE = "Noisebridge's Unofficial Open Sauce Afterparty";
export const EVENT_DESCRIPTION =
  "Noisebridge welcomes the participants of Open Sauce to come and celebrate our 20th year hacking and making in the Mission. We are an anarchist, non-profit hacker space full of makers like you. Bring your exhibits, projects, and we will provide music, food, drinks, and a great time <3";
const EVENT_LOCATION = "Noisebridge, 272 Capp St, San Francisco, CA";
const EVENT_START_COMPACT = "20260720T030000Z";
const EVENT_END_COMPACT = "20260720T090000Z";
const EVENT_START_ISO = "2026-07-20T03:00:00Z";
const EVENT_END_ISO = "2026-07-20T09:00:00Z";
export const PRODUCT_NAME = "OpenSauce Afterparty";
export const DEFAULT_PRICE: Cents = { cents: 2500 };
export const MINIMUM_PRICE: Cents = { cents: 0 };
export const MINIMUM_PAID_TOTAL: Cents = { cents: 50 };
export const MIN_QUANTITY = 1;
export const MAX_QUANTITY = 10;
export const CAPACITY = 200;

function buildRegistrationMetadata(
  pricePerTicket: Cents,
  quantity: number,
): Record<string, string> {
  return {
    type: REGISTRATION_TYPE,
    status:
      pricePerTicket.cents === 0
        ? REGISTRATION_CONFIRMED
        : REGISTRATION_PENDING,
    quantity: String(quantity),
    unitPrice: String(pricePerTicket.cents),
  };
}

function confirmedRegistrationTotals(
  metadata: Record<string, string>,
): { tickets: number; raised: Cents } | null {
  if (metadata["status"] !== REGISTRATION_CONFIRMED) {
    return null;
  }

  const tickets = Number.parseInt(metadata["quantity"] ?? "", 10);
  if (!validateQuantity(tickets)) {
    return null;
  }

  const unitPrice = Number.parseInt(metadata["unitPrice"] ?? "", 10);
  const raised = unitPrice * tickets;
  return {
    tickets,
    raised: {
      cents:
        Number.isSafeInteger(unitPrice) &&
        unitPrice >= 0 &&
        Number.isSafeInteger(raised)
          ? raised
          : 0,
    },
  };
}

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

let reservationQueue = Promise.resolve();

async function withReservationLock<T>(callback: () => Promise<T>): Promise<T> {
  const previous = reservationQueue;
  let release = () => {};
  reservationQueue = new Promise<void>((resolve) => {
    release = resolve;
  });

  await previous;
  try {
    return await callback();
  } finally {
    release();
  }
}

async function calculateAvailability(): Promise<TicketAvailability> {
  let claimed = 0;
  let confirmed = 0;
  let raised = 0;
  const pendingCutoff =
    Math.floor(Date.now() / 1000) - PENDING_RESERVATION_SECONDS;

  for await (const customer of stripe.customers.list({
    created: { gte: REGISTRATION_OPENED_AT },
    limit: 100,
  })) {
    if (customer.metadata["type"] !== REGISTRATION_TYPE) {
      continue;
    }

    const status = customer.metadata["status"];
    if (
      status === REGISTRATION_PENDING &&
      customer.created < pendingCutoff &&
      !(await retainExpiredReservation(customer))
    ) {
      continue;
    }
    if (status !== REGISTRATION_CONFIRMED && status !== REGISTRATION_PENDING) {
      continue;
    }

    const quantity = Number.parseInt(customer.metadata["quantity"] ?? "", 10);
    if (validateQuantity(quantity)) {
      claimed += quantity;
      const totals = confirmedRegistrationTotals(customer.metadata);
      if (totals) {
        confirmed += totals.tickets;
        raised += totals.raised.cents;
      }
    }
  }

  claimed = Math.min(claimed, CAPACITY);
  confirmed = Math.min(confirmed, CAPACITY);
  return {
    capacity: CAPACITY,
    claimed,
    confirmed,
    remaining: CAPACITY - claimed,
    raised: { cents: raised },
  };
}

async function retainExpiredReservation(
  customer: Stripe.Customer,
): Promise<boolean> {
  const paymentIntentId = customer.metadata["paymentIntentId"];
  if (!paymentIntentId) {
    await deleteReservation(customer.id);
    return false;
  }

  try {
    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
    if (paymentIntent.status === "succeeded") {
      await stripe.customers.update(customer.id, {
        metadata: { status: REGISTRATION_CONFIRMED },
      });
      return true;
    }
    if (paymentIntent.status === "processing") {
      return true;
    }
    if (paymentIntent.status !== "canceled") {
      await stripe.paymentIntents.cancel(paymentIntentId);
    }
    await deleteReservation(customer.id);
    return false;
  } catch (err) {
    log.error(
      { err, id: customer.id, paymentIntentId },
      "Failed to expire afterparty ticket reservation",
    );
    return true;
  }
}

export async function getAvailability(): Promise<TicketAvailability> {
  if (!config.production) {
    return {
      capacity: CAPACITY,
      claimed: 0,
      confirmed: 0,
      remaining: CAPACITY,
      raised: { cents: 0 },
    };
  }

  try {
    return await calculateAvailability();
  } catch (err) {
    log.error({ err }, "Failed to check afterparty ticket availability");
    return {
      capacity: CAPACITY,
      claimed: CAPACITY,
      confirmed: 0,
      remaining: 0,
      raised: { cents: 0 },
    };
  }
}

async function createReservation(
  pricePerTicket: Cents,
  quantity: number,
  email: string,
): Promise<{ success: true; id?: string } | { success: false }> {
  if (!config.production) {
    return { success: true };
  }

  return await withReservationLock(async () => {
    const availability = await calculateAvailability();
    if (quantity > availability.remaining) {
      return { success: false };
    }

    const customer = await stripe.customers.create({
      email,
      name: PRODUCT_NAME,
      metadata: buildRegistrationMetadata(pricePerTicket, quantity),
    });
    return { success: true, id: customer.id };
  });
}

async function deleteReservation(id: string | undefined): Promise<void> {
  if (!id) {
    return;
  }
  try {
    await stripe.customers.del(id);
  } catch (err) {
    log.error({ err, id }, "Failed to release afterparty ticket reservation");
  }
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

  const total: Cents = { cents: pricePerTicket.cents * quantity };
  if (total.cents > 0 && total.cents < MINIMUM_PAID_TOTAL.cents) {
    return { success: false, error: "InvalidDonationAmount" };
  }

  let reservation: Awaited<ReturnType<typeof createReservation>>;
  try {
    reservation = await createReservation(pricePerTicket, quantity, email);
  } catch (err) {
    log.error({ err }, "Failed to reserve afterparty tickets");
    return { success: false, error: "SessionError" };
  }
  if (!reservation.success) {
    return { success: false, error: "TicketsSoldOut" };
  }

  if (pricePerTicket.cents === 0) {
    const result = await emailManager.sendAfterpartyTicket(
      email,
      quantity,
      pricePerTicket,
    );
    if (result.success) {
      return { success: true, free: true };
    }
    await deleteReservation(reservation.id);
    return { success: false, error: "EmailSendFailed" };
  }

  let paymentIntent: Stripe.PaymentIntent;
  try {
    paymentIntent = await stripe.paymentIntents.create({
      amount: total.cents,
      currency: "usd",
      automatic_payment_methods: { enabled: true },
      description: PRODUCT_NAME,
      metadata: {
        name: PRODUCT_NAME,
        type: TICKET_TYPE,
        quantity: String(quantity),
        unitPrice: String(pricePerTicket.cents),
        email,
        ...(reservation.id ? { registrationId: reservation.id } : {}),
      },
    });
  } catch (err) {
    await deleteReservation(reservation.id);
    throw err;
  }
  if (!paymentIntent.client_secret) {
    await deleteReservation(reservation.id);
    return { success: false, error: "SessionError" };
  }
  if (reservation.id) {
    try {
      await stripe.customers.update(reservation.id, {
        metadata: { paymentIntentId: paymentIntent.id },
      });
    } catch (err) {
      try {
        await stripe.paymentIntents.cancel(paymentIntent.id);
      } catch (cancelError) {
        log.error(
          { err: cancelError, id: paymentIntent.id },
          "Failed to cancel untracked afterparty PaymentIntent",
        );
      }
      await deleteReservation(reservation.id);
      log.error({ err }, "Failed to link afterparty ticket reservation");
      return { success: false, error: "SessionError" };
    }
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

  const registrationId = paymentIntent.metadata["registrationId"];
  if (registrationId) {
    await stripe.customers.update(registrationId, {
      metadata: { status: REGISTRATION_CONFIRMED },
    });
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
