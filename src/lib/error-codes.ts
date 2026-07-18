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
  InvalidMonthlyDonationAmount = "Please select a valid monthly donation amount",
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

/**
 * Validates that an arbitrary value is a key of {@linkcode ErrorCode}. Query
 * parameters arrive as plain strings (or arrays), so they must be validated
 * before they can be treated as an {@linkcode ErrorCodeKey}.
 */
export function isErrorCodeKey(value: unknown): value is ErrorCodeKey {
  return typeof value === "string" && Object.keys(ErrorCode).includes(value);
}

/**
 * Validates that an arbitrary value is a key of {@linkcode InfoCode}.
 */
export function isInfoCodeKey(value: unknown): value is InfoCodeKey {
  return typeof value === "string" && Object.keys(InfoCode).includes(value);
}

export function formatMessages({ info, error }: MessageParams) {
  const messages: Message[] = [];

  if (error) {
    const text = ErrorCode[error];
    messages.push({ type: "error", text });
  }

  if (info) {
    const text = InfoCode[info];
    messages.push({ type: "info", text });
  }

  return messages;
}
