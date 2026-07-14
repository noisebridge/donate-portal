import type { IconDefinition } from "@fortawesome/fontawesome-svg-core";
import {
  faApple,
  faGoogle,
  faMicrosoft,
  faYahoo,
} from "@fortawesome/free-brands-svg-icons";
import { faCalendarPlus } from "@fortawesome/free-solid-svg-icons";
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
  confirmedTickets: number;
  amountRaised: Cents;
  isAuthenticated: boolean;
  messages?: Message[];
  csrfToken?: string | undefined;
}

const MINIMUM_PRICE_DOLLARS = ticketingManager.MINIMUM_PRICE.cents / 100;

function BrandIcon({ icon }: { icon: IconDefinition }) {
  const [width, height, , , path] = icon.icon;
  return (
    <svg
      class="calendar-icon"
      viewBox={`0 0 ${width} ${height}`}
      aria-hidden="true"
    >
      <path d={Array.isArray(path) ? path.join(" ") : path} />
    </svg>
  );
}

export function AfterpartyPage({
  price,
  remainingTickets,
  confirmedTickets,
  amountRaised,
  isAuthenticated,
  messages = [],
  csrfToken,
}: AfterpartyPageProps) {
  const priceDollars = price.cents / 100;
  const initialQty = ticketingManager.MIN_QUANTITY;
  const initialTotal: Cents = { cents: price.cents * initialQty };
  const maxQuantity = Math.min(ticketingManager.MAX_QUANTITY, remainingTickets);
  const calendarLinks = ticketingManager.calendarLinks();

  return (
    <Layout
      title="Noisebridge's Unofficial Open Sauce Afterparty"
      titleSuffix=""
      description={ticketingManager.EVENT_DESCRIPTION}
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

        <header class="poster-hero">
          <img
            class="poster-wordmark"
            src={paths.assetWithHash("image/afterparty-wordmark.svg")}
            alt="Open Sauce"
          />

          <h1 aria-label="Open Sauce Afterparty">Afterparty</h1>
          <p class="poster-host">
            Hosted by
            <br />
            <a
              href="https://www.google.com/maps/search/?api=1&query=Noisebridge%2C+272+Capp+St%2C+San+Francisco%2C+CA"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Open Noisebridge Hackerspace in maps (opens in a new tab)"
            >
              Noisebridge Hackerspace
            </a>
          </p>

          <img
            class="afterparty-logo"
            src={paths.assetWithHash("image/afterparty-logo.svg")}
            alt=""
            aria-hidden="true"
          />

          <time class="poster-date" datetime="2026-07-19T20:00:00-07:00">
            Jul 19
          </time>
          <p class="poster-time">8pm-2am</p>
          <a
            class="poster-address"
            href="https://www.google.com/maps/search/?api=1&query=Noisebridge%2C+272+Capp+St%2C+San+Francisco%2C+CA"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Open 272 Capp Street, San Francisco in maps (opens in a new tab)"
          >
            272
            <br />
            Capp
            <br />
            St, SF
          </a>
        </header>

        <p class="event-description">
          non-profit hacker party. bring projects.
          <br />
          we have food and drink.
        </p>

        <section class="ticket-section" aria-labelledby="ticket-heading">
          <div class="ticket-heading">
            <h2 id="ticket-heading">Tickets</h2>
            <details class="calendar-picker">
              <summary>Add to calendar</summary>
              <div class="calendar-menu">
                <a
                  href={calendarLinks.google}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Add to Google Calendar (opens in a new tab)"
                >
                  <BrandIcon icon={faGoogle} />
                  Google Calendar
                </a>
                <a
                  href={paths.afterpartyCalendar()}
                  download="noisebridge-open-sauce-afterparty.ics"
                >
                  <BrandIcon icon={faApple} />
                  Apple Calendar
                </a>
                <a
                  href={calendarLinks.outlook}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Add to Outlook.com (opens in a new tab)"
                >
                  <BrandIcon icon={faMicrosoft} />
                  Outlook.com
                </a>
                <a
                  href={calendarLinks.microsoft365}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Add to Microsoft 365 (opens in a new tab)"
                >
                  <BrandIcon icon={faMicrosoft} />
                  Microsoft 365
                </a>
                <a
                  href={calendarLinks.yahoo}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Add to Yahoo Calendar (opens in a new tab)"
                >
                  <BrandIcon icon={faYahoo} />
                  Yahoo Calendar
                </a>
                <a
                  href={paths.afterpartyCalendar()}
                  download="noisebridge-open-sauce-afterparty.ics"
                >
                  <BrandIcon icon={faCalendarPlus} />
                  Download .ics
                </a>
              </div>
            </details>
          </div>

          <dl class="ticket-stats">
            <div>
              <dt>Tickets bought</dt>
              <dd>
                <strong>
                  {confirmedTickets} / {ticketingManager.CAPACITY}
                </strong>
              </dd>
            </div>
            <div>
              <dt>Raised</dt>
              <dd>
                <strong>{formatAmount(amountRaised)}</strong>
              </dd>
            </div>
          </dl>

          {remainingTickets > 0 ? (
            <form
              id="afterparty-form"
              method="POST"
              action={paths.afterparty()}
              aria-label="Ticket order"
            >
              <input type="hidden" name="_csrf" value={csrfToken} />

              <div class="ticket-options">
                <div class="form-field quantity-field">
                  <label for="qty-input">
                    Quantity
                    {remainingTickets <= ticketingManager.MAX_QUANTITY && (
                      <span class="availability-hint" id="availability-hint">
                        {remainingTickets} available
                      </span>
                    )}
                  </label>
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
                        role="spinbutton"
                        aria-valuemin={ticketingManager.MIN_QUANTITY}
                        aria-valuemax={maxQuantity}
                        aria-valuenow={initialQty}
                        aria-describedby={
                          remainingTickets <= ticketingManager.MAX_QUANTITY
                            ? "availability-hint"
                            : undefined
                        }
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
                      aria-describedby="price-hint"
                      autocomplete="off"
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
              <span>
                All {ticketingManager.CAPACITY} tickets have been claimed.
              </span>
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
