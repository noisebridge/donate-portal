import { escapeHtml } from "@kitajs/html";
import { Layout } from "~/components/layout";
import { StripeCheckoutModal } from "~/components/stripe-checkout-modal";
import { formatAmount } from "~/lib/money";
import paths from "~/lib/paths";
import * as donationManager from "~/managers/donation";
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
  const minDollars = donationManager.MINIMUM_AMOUNT.cents / 100;
  const initialDollars = amount.cents / 100;
  const maxDollars = initialDollars * 2;
  const maxAmount: Cents = { cents: amount.cents * 2 };

  return (
    <Layout
      title="Donate to Noisebridge"
      script="qr.mjs"
      styles="qr.css"
      isAuthenticated={isAuthenticated}
      csrfToken={csrfToken}
    >
      <div class="donate">
        <form id="donate-form" method="POST" action={paths.donate()}>
          <input type="hidden" name="_csrf" value={csrfToken} />

          <div class="product-card offset-frame">
            <div class="product-card-head">
              <span class="editable-label">Product</span>
              <label class="toggle">
                <input type="checkbox" id="custom-toggle" />
                <span class="toggle-track">
                  <span class="toggle-thumb"></span>
                </span>
                <span class="toggle-label">Custom</span>
              </label>
            </div>
            <label class="editable-field">
              <input
                type="text"
                id="name"
                name="name"
                class="product-name-input"
                value={name ? escapeHtml(name) : ""}
                placeholder={donationManager.DEFAULT_NAME}
                maxlength={donationManager.MAX_NAME_LENGTH}
                autocomplete="off"
                autocapitalize="off"
                autocorrect="off"
                spellcheck={false}
                data-1p-ignore
                data-lpignore="true"
                data-form-type="other"
                data-bwignore
                readonly
              />
            </label>
            <label class="editable-field">
              <span class="editable-label">Description</span>
              <textarea
                id="description"
                name="description"
                class="product-desc-input"
                rows="2"
                placeholder={donationManager.DEFAULT_DESCRIPTION}
                maxlength={donationManager.MAX_DESCRIPTION_LENGTH}
                readonly
              >
                {description ? escapeHtml(description) : ""}
              </textarea>
            </label>
          </div>

          <section class="adjust">
            <div class="your-amount-display">
              <span class="dol">$</span>
              <input
                type="text"
                inputmode="decimal"
                id="amount-input"
                name="amount-dollars"
                class="val val-input"
                value={initialDollars.toFixed(2)}
                data-min={minDollars}
                aria-label="Donation amount"
                required
              />
            </div>

            <span class="form-hint" id="amount-hint">
              Minimum {formatAmount(donationManager.MINIMUM_AMOUNT) as "safe"}
            </span>

            <div class="slider-wrap">
              <input
                type="range"
                id="amount-slider"
                class="slider"
                min={minDollars.toString()}
                max={maxDollars.toString()}
                step="1"
                value={initialDollars.toString()}
                aria-label="Donation amount"
              />
              <div class="slider-ticks" id="slider-ticks">
                {minDollars !== initialDollars && (
                  <button type="button" class="tick" data-amt={minDollars}>
                    <span class="pip"></span>
                    <span class="label">
                      {formatAmount(donationManager.MINIMUM_AMOUNT) as "safe"}
                    </span>
                  </button>
                )}
                <button type="button" class="tick" data-amt={initialDollars}>
                  <span class="pip"></span>
                  <span class="label">{formatAmount(amount) as "safe"}</span>
                </button>
                <button type="button" class="tick" data-amt={maxDollars}>
                  <span class="pip"></span>
                  <span class="label">{formatAmount(maxAmount) as "safe"}</span>
                </button>
              </div>
            </div>
          </section>

          <button type="submit" class="btn btn-primary">
            <span id="donate-label">
              {`Donate · ${formatAmount(amount)}` as "safe"}
            </span>
            <span aria-hidden="true">{"→"}</span>
          </button>
        </form>

        <div class="divider">or</div>

        <div class="alt-stack">
          {!donationManager.isGeneral(name) && (
            <a class="btn btn-ghost" href={`${paths.index()}#donate`}>
              <span class="lead">
                <span class="lbl">Make a general donation</span>
                <span class="sub">keeps the lights on</span>
              </span>
              <span class="arrow">{"→"}</span>
            </a>
          )}
          <a class="btn btn-ghost" href={paths.signIn()}>
            <span class="lead">
              <span class="lbl">Give monthly</span>
              <span class="sub">become a supporting member</span>
            </span>
            <span class="arrow">{"→"}</span>
          </a>
        </div>
      </div>

      <StripeCheckoutModal title="Complete Your Donation" />
    </Layout>
  );
}
