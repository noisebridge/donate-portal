import { escapeHtml } from "@kitajs/html";
import { Layout } from "~/components/layout";
import { DonationManager } from "~/managers/donation";
import { type Cents, formatAmount } from "~/money";
import paths from "~/paths";

export interface QrCustomPageProps {
  amount: Cents;
  name?: string | undefined;
  description?: string | undefined;
  isAuthenticated: boolean;
}

export function QrCustomPage({
  amount,
  name,
  description,
  isAuthenticated,
}: QrCustomPageProps) {
  const minDollars = DonationManager.minimumAmount.cents / 100;
  const initialDollars = amount.cents / 100;

  return (
    <Layout
      title="Custom Donation"
      script="qr-custom.mjs"
      styles="qr-custom.css"
      isAuthenticated={isAuthenticated}
    >
      <div class="container-narrow">
        <div class="card text-center" style="position: relative;">
          <a
            href={paths.qr(amount, name, description)}
            class="btn btn-outline qr-back-btn"
          >
            Back
          </a>
          <form class="qr-custom-form" method="POST" action={paths.donate()}>
            <div class="form-group qr-custom-name-group">
              <input
                type="text"
                id="name"
                name="name"
                class="qr-custom-editable qr-custom-name-input"
                placeholder="Name (optional)"
                value={name ? (escapeHtml(name) as "safe") : undefined}
                maxlength={DonationManager.maxNameLength}
              />
            </div>

            <div class="form-group qr-custom-description-group">
              <input
                type="text"
                id="description"
                name="description"
                class="qr-custom-editable qr-custom-description-input"
                placeholder="Description (optional)"
                value={
                  description ? (escapeHtml(description) as "safe") : undefined
                }
                maxlength={DonationManager.maxDescriptionLength}
              />
            </div>

            <div class="form-group qr-custom-amount-wrapper">
              <div class="input-group qr-custom-amount-group">
                <span
                  class="input-prefix qr-custom-amount-prefix"
                  aria-hidden="true"
                >
                  $
                </span>
                <input
                  type="text"
                  inputmode="decimal"
                  id="amount"
                  name="amount-dollars"
                  class="qr-custom-editable qr-custom-amount-input"
                  value={initialDollars.toFixed(2)}
                  data-min={minDollars}
                  required
                />
              </div>
              <span class="form-hint">
                Minimum {formatAmount(DonationManager.minimumAmount) as "safe"}
              </span>
            </div>

            <button type="submit" class="btn btn-primary btn-large">
              Donate
            </button>
          </form>
        </div>
      </div>
    </Layout>
  );
}
