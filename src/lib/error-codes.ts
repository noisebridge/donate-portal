import type { MessageParams } from "~/lib/paths";
import type { Message } from "~/types/message";

export enum ErrorCode {
  InvalidState = "Invalid OAuth state parameter",
  InvalidRequest = "Invalid request parameters",
  GithubError = "GitHub raised an error",
  GoogleError = "Google raised an error",
  OAuthFailed = "Failed to perform OAuth",
  NoEmail = "Could not find an email address for you",
  EmailInvalid = "Invalid email address",
  EmailSendFailed = "Failed to send email. Please try again.",
  InvalidMagicLink = "Invalid magic link",
  MagicLinkExpired = "Magic link has expired. Please request a new one.",
  InvalidDonationAmount = "Please select a valid donation amount",
  InvalidMonthlyDonationAmount = "Please select a valid donation amount",
  SessionError = "Unable to process donation. Please try again.",
  SameAmount = "Select a different donation amount",
  NoCustomer = "No Stripe customer found",
  NoSubscription = "No active monthly donation found to cancel",
  NoLineItem = "No line items in your active subscription",
  CreateError = "Unable to create monthly donation. Please try again.",
  CancelError = "Unable to cancel monthly donation. Please try again.",
  UpdateError = "Unable to update donation amount. Please try again.",
  PortalError = "Unable to create billing portal session",
  PastDue = "Your subscription is past due! Click the Payment Methods button to fix it.",
}

export type ErrorCodeKey = keyof typeof ErrorCode;

export enum InfoCode {
  SubscriptionCreated = "Your monthly donation has been set up. Thank you!",
  SubscriptionUpdated = "Your donation amount has been updated. The new amount will apply to the next billing cycle.",
  SubscriptionCancelled = "Your monthly donation has been cancelled. No further charges will be made.",
}

export type InfoCodeKey = keyof typeof InfoCode;

function getDisplayText(
  enumObj: Record<string, string>,
  key: string,
): string | undefined {
  if (!(key in enumObj)) {
    return undefined;
  }

  return enumObj[key];
}

export function formatMessages({ info, error }: MessageParams) {
  const messages: Message[] = [];

  if (error) {
    const text = getDisplayText(ErrorCode, error);
    if (text) {
      messages.push({ type: "error", text });
    }
  }

  if (info) {
    const text = getDisplayText(InfoCode, info);
    if (text) {
      messages.push({ type: "info", text });
    }
  }

  return messages;
}
