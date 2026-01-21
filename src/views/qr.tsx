import { Layout } from "~/components/layout";
import { DonationManager } from "~/managers/donation";
import { type Cents, formatAmount } from "~/money";
import paths from "~/paths";

export interface QrPageProps {
  amount: Cents;
  name?: string | undefined;
  description?: string | undefined;
}

export function QrPage({ amount, name, description }: QrPageProps) {
  const minDollars = DonationManager.minimumAmount.cents / 100;
  const maxDollars = (amount.cents * 2) / 100;
  const initialDollars = amount.cents / 100;

  return (
    <Layout
      title="Donate to Noisebridge"
      script="qr.mjs"
      styles="qr.css"
      isAuthenticated={false}
    >
      <div class="container-narrow">
        <div class="card text-center">
          {name && <h1 class="qr-donate-name">{name}</h1>}
          {description && <p class="qr-donate-description">{description}</p>}

          <div class="qr-amount-display">
            <span id="current-amount">{formatAmount(amount)}</span>
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
              <span>{formatAmount(DonationManager.minimumAmount)}</span>
              <span>{formatAmount({ cents: amount.cents * 2 })}</span>
            </div>
          </div>

          <form method="POST" action={paths.donate()}>
            <input
              type="hidden"
              name="amount-dollars"
              id="hidden-amount"
              value={initialDollars.toString()}
            />
            {name && <input type="hidden" name="name" value={name} />}
            {description && (
              <input type="hidden" name="description" value={description} />
            )}
            <button type="submit" class="btn btn-primary btn-large">
              Donate
            </button>
          </form>
        </div>
      </div>
    </Layout>
  );
}
