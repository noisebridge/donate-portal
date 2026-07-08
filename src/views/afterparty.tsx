import { Layout } from "~/components/layout";
import { type Message, MessageContainer } from "~/components/message-container";
import { StripeCheckoutModal } from "~/components/stripe-checkout-modal";
import { formatAmount } from "~/lib/money";
import paths from "~/lib/paths";
import * as ticketingManager from "~/managers/ticketing";
import type { Cents } from "~/types/cents";

export interface AfterpartyPageProps {
  price: Cents;
  isAuthenticated: boolean;
  messages?: Message[];
  csrfToken?: string | undefined;
}

/** Fixed slider bounds for the per-ticket price, in whole dollars. */
const SLIDER_MIN = ticketingManager.MINIMUM_PRICE.cents / 100;
const SLIDER_MAX = 100;

export function AfterpartyPage({
  price,
  isAuthenticated,
  messages = [],
  csrfToken,
}: AfterpartyPageProps) {
  const priceDollars = price.cents / 100;
  const initialQty = ticketingManager.MIN_QUANTITY;
  const initialTotal: Cents = { cents: price.cents * initialQty };

  const midPrice: Cents = { cents: ticketingManager.DEFAULT_PRICE.cents };
  const maxPrice: Cents = { cents: SLIDER_MAX * 100 };

  return (
    <Layout
      title="OpenSauce Afterparty"
      script="afterparty.mjs"
      styles="afterparty.css"
      isAuthenticated={isAuthenticated}
      csrfToken={csrfToken}
    >
      <div class="afterparty">
        <MessageContainer messages={messages} />

        <h1 class="event-title">
          Noisebridge
          <br />
          <span class="accent">Open Sauce Afterparty</span>
        </h1>

        <div class="event-meta">
          <div class="cell">
            <div class="k">Date</div>
            <div class="v">
              Sun Jul 19<small>8PM – late</small>
            </div>
          </div>
          <div class="cell">
            <div class="k">Where</div>
            <div class="v">
              Noisebridge<small>272 Capp St, SF</small>
            </div>
          </div>
        </div>

        <p class="event-blurb">
          The unofficial afterparty for Open Sauce. Live sets, blinkenlights,
          and Club-Maté on ice. Tickets are pay-what-you-can — every dollar over
          cost covers for those that can't pay full price.
        </p>

        <form id="afterparty-form" method="POST" action={paths.afterparty()}>
          <input type="hidden" name="_csrf" value={csrfToken} />

          <div class="qty-block">
            <span class="field-label">How many tickets?</span>
            <div class="stepper">
              <button type="button" id="qty-minus" aria-label="Fewer tickets">
                {"−"}
              </button>
              <div class="qty-field">
                <input
                  type="text"
                  inputmode="numeric"
                  id="qty-input"
                  name="quantity"
                  value={initialQty.toString()}
                  aria-label="Number of tickets"
                  autocomplete="off"
                  required
                />
                <span class="sub" id="qty-sub">
                  ticket
                </span>
              </div>
              <button type="button" id="qty-plus" aria-label="More tickets">
                +
              </button>
            </div>
          </div>

          <div class="price-block">
            <div class="price-head">
              <span class="field-label">Price per ticket</span>
              <span class="hint">
                {
                  `Suggested ${formatAmount(ticketingManager.DEFAULT_PRICE)}` as "safe"
                }
              </span>
            </div>

            <div class="price-display">
              <span class="dol">$</span>
              <input
                type="text"
                inputmode="decimal"
                id="price-input"
                name="price-dollars"
                class="val val-input"
                value={priceDollars.toFixed(2)}
                data-min={SLIDER_MIN}
                aria-label="Price per ticket"
                required
              />
              <span class="per">
                per ticket
                <span class="tag" id="price-tag">
                  suggested
                </span>
              </span>
            </div>

            <span class="form-hint" id="price-hint">
              Minimum {formatAmount(ticketingManager.MINIMUM_PRICE) as "safe"}
            </span>

            <div class="slider-wrap">
              <input
                type="range"
                id="price-slider"
                class="slider"
                min={SLIDER_MIN.toString()}
                max={SLIDER_MAX.toString()}
                step="1"
                value={priceDollars.toString()}
                aria-label="Price per ticket"
              />
              <div class="slider-ticks" id="slider-ticks">
                <button type="button" class="tick" data-amt={SLIDER_MIN}>
                  <span class="pip"></span>
                  <span class="label">
                    {formatAmount(ticketingManager.MINIMUM_PRICE) as "safe"}
                  </span>
                </button>
                <button
                  type="button"
                  class="tick"
                  data-amt={midPrice.cents / 100}
                >
                  <span class="pip"></span>
                  <span class="label">{formatAmount(midPrice) as "safe"}</span>
                </button>
                <button type="button" class="tick" data-amt={SLIDER_MAX}>
                  <span class="pip"></span>
                  <span class="label">{formatAmount(maxPrice) as "safe"}</span>
                </button>
              </div>
            </div>
          </div>

          <label class="email-field">
            <span class="editable-label">Where do we send your tickets?</span>
            <input
              type="email"
              id="email"
              name="email"
              class="email-input"
              placeholder="you@example.com"
              autocomplete="email"
              required
            />
          </label>

          <div class="receipt">
            <div class="line">
              <span id="receipt-calc" class="calc">
                {`${initialQty} × ${formatAmount(price)}` as "safe"}
              </span>
            </div>
            <hr class="rule" />
            <div class="total">
              <span class="lbl">Total due</span>
              <span class="amt" id="total-amt">
                {formatAmount(initialTotal) as "safe"}
              </span>
            </div>
          </div>

          <button type="submit" class="btn btn-primary">
            <span id="continue-label">
              {
                `Get ${initialQty} ticket · ${formatAmount(initialTotal)}` as "safe"
              }
            </span>
            <span aria-hidden="true">{"→"}</span>
          </button>
        </form>

        <p class="tax-note">
          Noisebridge is a 501(c)(3) nonprofit. Ticket sales are a
          tax-deductible donation. EIN 26-3507741.
        </p>
      </div>

      <StripeCheckoutModal
        title="Complete Your Purchase"
        submitLabel="Pay Now"
      />
    </Layout>
  );
}
