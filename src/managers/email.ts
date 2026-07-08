import config from "~/config";
import { AfterpartyTicketEmail } from "~/emails/afterparty-ticket";
import { MagicLinkEmail } from "~/emails/magic-link";
import { SubscriptionCanceledEmail } from "~/emails/subscription-canceled";
import { SubscriptionPastDueEmail } from "~/emails/subscription-past-due";
import { SubscriptionUpdatedEmail } from "~/emails/subscription-updated";
import { SubscriptionWelcomeEmail } from "~/emails/subscription-welcome";
import baseLogger from "~/lib/logger";
import * as magicLinkManager from "~/managers/magic-link";
import resend from "~/services/email";
import type { Cents } from "~/types/cents";

export type EmailResult =
  | { success: true; id: string }
  | { success: false; error: string };

const log = baseLogger.child({ module: "email" });

const FROM_ADDRESS = `Noisebridge <${config.emailSender}>`;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isValid(email: string): boolean {
  return email.length <= 254 && EMAIL_PATTERN.test(email);
}

async function send(params: {
  to: string;
  subject: string;
  html: string;
}): Promise<EmailResult> {
  const { data, error } = await resend.emails.send({
    from: FROM_ADDRESS,
    ...params,
  });
  if (error) {
    log.error({ error, to: params.to }, "Email send returned error");
    return { success: false, error: error.message };
  }

  return { success: true, id: data.id };
}

export async function sendMagicLink(email: string): Promise<EmailResult> {
  const magicLinkUrl = magicLinkManager.generateUrl(email);
  const emailHtml = await MagicLinkEmail({ magicLinkUrl });

  return await send({
    to: email,
    subject: "Sign in to donate.noisebridge.net",
    html: emailHtml,
  });
}

export async function sendAfterpartyTicket(
  email: string,
  quantity: number,
  amount: Cents,
): Promise<EmailResult> {
  const emailHtml = await AfterpartyTicketEmail({ quantity, amount });

  return await send({
    to: email,
    subject: "Your Noisebridge OpenSauce Afterparty tickets",
    html: emailHtml,
  });
}

export async function sendSubscriptionCanceled(
  email: string,
  amount?: Cents,
): Promise<EmailResult> {
  const emailHtml = await SubscriptionCanceledEmail({ amount });

  return await send({
    to: email,
    subject: "Your monthly donation to Noisebridge has been canceled",
    html: emailHtml,
  });
}

export async function sendSubscriptionWelcome(
  email: string,
  amount: Cents,
): Promise<EmailResult> {
  const emailHtml = await SubscriptionWelcomeEmail({ amount });

  return await send({
    to: email,
    subject: "Welcome! Your monthly donation to Noisebridge is set up",
    html: emailHtml,
  });
}

export async function sendSubscriptionPastDue(
  email: string,
  amount?: Cents,
): Promise<EmailResult> {
  const emailHtml = await SubscriptionPastDueEmail({ amount });

  return await send({
    to: email,
    subject: "Payment issue with your Noisebridge donation",
    html: emailHtml,
  });
}

export async function sendSubscriptionUpdated(
  email: string,
  oldAmount: Cents,
  newAmount: Cents,
): Promise<EmailResult> {
  const emailHtml = await SubscriptionUpdatedEmail({ oldAmount, newAmount });

  return await send({
    to: email,
    subject: "Your Noisebridge donation amount has been updated",
    html: emailHtml,
  });
}
