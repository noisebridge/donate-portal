import { escapeHtml } from "@kitajs/html";
import type Stripe from "stripe";
import { Button } from "~/components/button";
import {
  DonationTierSelector,
  TIERS,
} from "~/components/donation-tier-selector";
import { Layout } from "~/components/layout";
import { type Message, MessageContainer } from "~/components/message-container";
import { PageHead } from "~/components/page-head";
import { SectionHead } from "~/components/section-head";
import { StripeCheckoutModal } from "~/components/stripe-checkout-modal";
import { formatAmount } from "~/money";
import paths from "~/paths";

export interface ManageProps {
  email: string;
  subscription?: Stripe.Subscription | undefined;
  messages?: Message[];
}

function subscriptionItem(subscription?: Stripe.Subscription) {
  return subscription?.items?.data[0] ?? null;
}

function formatRenewalDate(
  item: Stripe.SubscriptionItem | null,
): string | null {
  if (!item) return null;

  const date = new Date(item.current_period_end * 1000);
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function tierNameFromCents(cents: number | null): string {
  if (cents === null) return "Unknown";

  const dollars = cents / 100;
  return TIERS.find((tier) => tier.amount === dollars)?.name ?? "Custom";
}

function pillClass(status: Stripe.Subscription.Status): string {
  switch (status) {
    case "active":
    case "trialing":
      return "pill pill-ok";
    case "canceled":
    case "incomplete_expired":
      return "pill pill-stopped";
    default:
      return "pill pill-warn";
  }
}

export function ManagePage({
  email,
  subscription,
  messages = [],
}: ManageProps) {
  const item = subscriptionItem(subscription);
  const amountCents = item?.price?.unit_amount ?? null;
  const renewalDate = formatRenewalDate(item);
  const amountFormatted =
    amountCents === null ? null : formatAmount({ cents: amountCents });
  const tierName = tierNameFromCents(amountCents);

  return (
    <Layout
      title={subscription ? "Manage your Donation" : "Set Up your Donation"}
      styles="manage.css"
      script="manage.mjs"
      isAuthenticated
    >
      <div class="container manage-container">
        <MessageContainer messages={messages} />

        <PageHead title="manage_subscription" />

        <div class="who-line">
          <span class="who-lbl">Signed in as</span>
          <span class="who-email">{escapeHtml(email)}</span>
        </div>

        {!!subscription && (
          <div class="status-strip">
            <div class="cell">
              <span class="lbl">Status</span>
              <span class={pillClass(subscription.status)}>
                {subscription.status}
              </span>
            </div>
            <div class="cell">
              <span class="lbl">Current tier</span>
              <span class="val">{tierName as "safe"}</span>
            </div>
            <div class="cell">
              <span class="lbl">Monthly</span>
              <span class="val">
                <span class="big">{amountFormatted as "safe"}</span>
              </span>
            </div>
            <div class="cell">
              <span class="lbl">Next charge</span>
              <span class="val">{renewalDate as "safe"}</span>
            </div>
          </div>
        )}

        {!subscription && (
          <div class="status-null">
            You don't have an active monthly gift yet. Pick a tier below to
            start one — you can cancel or change the amount anytime.
          </div>
        )}

        <DonationTierSelector subscription={subscription} />

        <section class="account-actions-section">
          <SectionHead
            title="account_actions"
            meta="Manage billing & history"
          />

          {!!subscription && (
            <div class="action-stack">
              <form method="POST" action={paths.stripePortal()}>
                <Button variant="ghost" suffix={"\u2197"} type="submit">
                  Past invoices &amp; payment method
                </Button>
              </form>

              <form
                method="POST"
                action={paths.cancel()}
                class="cancel-subscription-form"
              >
                <Button
                  variant="ghost"
                  danger
                  suffix={"\u00d7"}
                  type="submit"
                  aria-live="polite"
                >
                  Cancel subscription
                </Button>
              </form>
            </div>
          )}

          {!subscription && (
            <p class="no-sub-hint">
              Billing history and payment methods will appear here once you
              start a monthly gift.
            </p>
          )}
        </section>

        <StripeCheckoutModal
          title="Complete Your Subscription"
          donateButton={false}
        />
      </div>
    </Layout>
  );
}
