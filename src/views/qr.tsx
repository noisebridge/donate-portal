import { escapeHtml } from "@kitajs/html";
import { Button } from "~/components/button";
import { Layout } from "~/components/layout";
import { StripeCheckoutModal } from "~/components/stripe-checkout-modal";
import donationManager, { DonationManager } from "~/managers/donation";
import { formatAmount } from "~/money";
import paths from "~/paths";
import type { Cents } from "~/types/cents";

export interface QrPageProps {
  amount: Cents;
  name?: string | undefined;
  description?: string | undefined;
  isAuthenticated: boolean;
}

export function QrPage({
  amount,
  name,
  description,
  isAuthenticated,
}: QrPageProps) {
  const minDollars = DonationManager.minimumAmount.cents / 100;
  const maxDollars = (amount.cents * 2) / 100;
  const initialDollars = amount.cents / 100;

  return (
    <Layout
      title="Donate to Noisebridge"
      script="qr.mjs"
      styles="qr.css"
      isAuthenticated={isAuthenticated}
    >
      <div class="container-narrow">
        <div class="card text-center" style="position: relative;">
          <a
            href={paths.qrCustom(amount, name, description)}
            class="qr-corner-btn"
          >
            Custom
          </a>
          <div class="qr-product-details">
            {!!name && (
              <h1 class="qr-donate-name">{escapeHtml(name) as "safe"}</h1>
            )}
            {!!description && (
              <p class="qr-donate-description">
                {escapeHtml(description) as "safe"}
              </p>
            )}
          </div>

          <div class="qr-amount-display">
            <span id="current-amount">{formatAmount(amount) as "safe"}</span>
          </div>

          <div class="qr-slider-container">
            <input
              type="range"
              id="amount-slider"
              min={minDollars.toString()}
              max={maxDollars.toString()}
              value={initialDollars.toString()}
              step="1"
              aria-label="Donation amount"
            />
            <div class="qr-slider-labels">
              <span>
                {formatAmount(DonationManager.minimumAmount) as "safe"}
              </span>
              <span>{formatAmount({ cents: amount.cents * 2 }) as "safe"}</span>
            </div>
          </div>

          <form id="donate-form" method="POST" action={paths.donate()}>
            <input
              type="hidden"
              name="amount-dollars"
              id="hidden-amount"
              value={initialDollars.toString()}
            />
            {!!name && (
              <input
                type="hidden"
                name="name"
                value={escapeHtml(name) as "safe"}
              />
            )}
            {!!description && (
              <input
                type="hidden"
                name="description"
                value={escapeHtml(description) as "safe"}
              />
            )}
            <Button variant="primary" type="submit">
              Donate
            </Button>
          </form>

          <div class="divider">or</div>

          <div class="qr-actions">
            {!donationManager.isGeneral(name) && (
              <Button variant="outline" href={`${paths.index()}#donate`}>
                Make a general donation
              </Button>
            )}

            <Button variant="outline" href={paths.signIn()}>
              Give monthly
            </Button>
          </div>
        </div>
      </div>

      <StripeCheckoutModal title="Complete Your Donation" />
    </Layout>
  );
}
