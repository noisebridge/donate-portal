import { escapeHtml } from "@kitajs/html";
import { Button } from "~/components/button";
import { Layout } from "~/components/layout";
import { StripeCheckoutModal } from "~/components/stripe-checkout-modal";
import { formatAmount } from "~/lib/money";
import paths from "~/lib/paths";
import { DonationManager } from "~/managers/donation";
import type { Cents } from "~/types/cents";

export interface QrPageProps {
  amount: Cents;
  name?: string | undefined;
  description?: string | undefined;
  isAuthenticated: boolean;
  csrfToken?: string | undefined;
}

export function QrPage({
  amount,
  name,
  description,
  isAuthenticated,
  csrfToken,
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
      csrfToken={csrfToken}
    >
      <div class="container-narrow">
        <div class="card text-center">
          <a
            href={paths.qrCustom(amount, name, description)}
            class="qr-corner-btn"
          >
            Custom
          </a>
          <div class="qr-product-details">
            {!!name && <h1 class="qr-donate-name">{escapeHtml(name)}</h1>}
            {!!description && (
              <p class="qr-donate-description">{escapeHtml(description)}</p>
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
            <input type="hidden" name="_csrf" value={csrfToken} />
            <input
              type="hidden"
              name="amount-dollars"
              id="hidden-amount"
              value={initialDollars.toString()}
            />
            {!!name && (
              <input type="hidden" name="name" value={escapeHtml(name)} />
            )}
            {!!description && (
              <input
                type="hidden"
                name="description"
                value={escapeHtml(description)}
              />
            )}
            <Button variant="primary" type="submit">
              Donate
            </Button>
          </form>

          <div class="divider">or</div>

          <div class="qr-actions">
            {!DonationManager.isGeneral(name) && (
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
