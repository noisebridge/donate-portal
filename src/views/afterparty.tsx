import { Layout } from "~/components/layout";
import { type Message, MessageContainer } from "~/components/message-container";
import { StripeCheckoutModal } from "~/components/stripe-checkout-modal";
import { formatAmount } from "~/lib/money";
import paths from "~/lib/paths";
import * as ticketingManager from "~/managers/ticketing";
import type { Cents } from "~/types/cents";

export interface AfterpartyPageProps {
  price: Cents;
  remainingTickets: number;
  isAuthenticated: boolean;
  messages?: Message[];
  csrfToken?: string | undefined;
}

const MINIMUM_PRICE_DOLLARS = ticketingManager.MINIMUM_PRICE.cents / 100;

export function AfterpartyPage({
  price,
  remainingTickets,
  isAuthenticated,
  messages = [],
  csrfToken,
}: AfterpartyPageProps) {
  const priceDollars = price.cents / 100;
  const initialQty = ticketingManager.MIN_QUANTITY;
  const initialTotal: Cents = { cents: price.cents * initialQty };
  const maxQuantity = Math.min(ticketingManager.MAX_QUANTITY, remainingTickets);

  return (
    <Layout
      title="Noisebridge's Unofficial Open Sauce Afterparty"
      titleSuffix=""
      description="The unofficial Open Sauce afterparty at Noisebridge in San Francisco, with live sets, blinkenlights, and Club-Maté on ice."
      favicon="image/afterparty-favicon.svg"
      socialImage="image/afterparty-logo.svg"
      themeColor="#FF0000"
      styles="afterparty.css"
      script="afterparty.mjs"
      bare
      isAuthenticated={isAuthenticated}
      csrfToken={csrfToken}
    >
      <div class="afterparty-foundation">
        <MessageContainer messages={messages} />

        <h1 aria-label="Noisebridge's Unofficial Open Sauce Afterparty">
          <span aria-hidden="true">
            <span class="title-line">
              <span class="title-possessive">
                Noisebridge<span class="title-apostrophe"></span>
              </span>
              s Unofficial
            </span>
            <span class="title-line">Open Sauce Afterparty</span>
          </span>
        </h1>

        <img
          class="afterparty-logo"
          src={paths.assetWithHash("image/afterparty-logo.svg")}
          alt="Noisebridge Open Sauce afterparty logo"
        />

        <section class="ticket-section" aria-labelledby="ticket-heading">
          <div class="ticket-heading">
            <h2 id="ticket-heading">Tickets</h2>
            <div class="ticket-meta">
              <span>{remainingTickets} left</span>
              <a
                href={paths.afterpartyCalendar()}
                download="noisebridge-open-sauce-afterparty.ics"
              >
                Add to calendar
              </a>
            </div>
          </div>

          {remainingTickets > 0 ? (
            <form
              id="afterparty-form"
              method="POST"
              action={paths.afterparty()}
            >
              <input type="hidden" name="_csrf" value={csrfToken} />

              <div class="ticket-options">
                <div class="form-field quantity-field">
                  <label for="qty-input">Quantity</label>
                  <div class="stepper">
                    <button
                      type="button"
                      id="qty-minus"
                      aria-label="Fewer tickets"
                      disabled
                    >
                      -
                    </button>
                    <div class="qty-field">
                      <input
                        type="text"
                        inputmode="numeric"
                        id="qty-input"
                        name="quantity"
                        value={initialQty.toString()}
                        data-max={maxQuantity}
                        autocomplete="off"
                        required
                      />
                      <span id="qty-sub">ticket</span>
                    </div>
                    <button
                      type="button"
                      id="qty-plus"
                      aria-label="More tickets"
                      disabled={maxQuantity === initialQty}
                    >
                      +
                    </button>
                  </div>
                </div>

                <div class="form-field price-field">
                  <label for="price-input">Pay what you can</label>
                  <div class="price-input-wrap">
                    <span>$</span>
                    <input
                      type="text"
                      inputmode="decimal"
                      id="price-input"
                      name="price-dollars"
                      value={priceDollars.toFixed(2)}
                      data-min={MINIMUM_PRICE_DOLLARS}
                      data-minimum-paid-total-cents={
                        ticketingManager.MINIMUM_PAID_TOTAL.cents
                      }
                      required
                    />
                  </div>
                  <div class="price-guidance">
                    <span class="form-hint" id="price-hint">
                      Enter any amount, including $0
                    </span>
                  </div>
                </div>
              </div>

              <div class="form-field">
                <label for="email">Email for your tickets</label>
                <input
                  type="email"
                  id="email"
                  name="email"
                  class="email-input"
                  placeholder="you@example.com"
                  autocomplete="email"
                  required
                />
              </div>

              <button type="submit" class="ticket-submit">
                <span id="continue-label">
                  {
                    `Pay ${formatAmount(initialTotal)} - Get ${initialQty} ticket` as "safe"
                  }
                </span>
              </button>
            </form>
          ) : (
            <div class="sold-out">
              <strong>Sold out</strong>
              <span>All 10 tickets have been claimed.</span>
            </div>
          )}
        </section>
      </div>

      <StripeCheckoutModal
        title="Complete Your Purchase"
        submitLabel="Pay Now"
      />
    </Layout>
  );
}
