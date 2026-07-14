import { Button } from "~/components/button";
import { Layout } from "~/components/layout";
import { type Message, MessageContainer } from "~/components/message-container";
import { SectionHead } from "~/components/section-head";
import { StripeCheckoutModal } from "~/components/stripe-checkout-modal";
import paths from "~/lib/paths";
import * as donationManager from "~/managers/donation";

export interface IndexProps {
  isAuthenticated: boolean;
  messages?: Message[];
  csrfToken?: string | undefined;
}

export function IndexPage({
  isAuthenticated,
  messages = [],
  csrfToken,
}: IndexProps) {
  return (
    <Layout
      title="Donate to Noisebridge!"
      script="index.mjs"
      styles="index.css"
      isAuthenticated={isAuthenticated}
      csrfToken={csrfToken}
    >
      <div class="shell">
        {/*<a class="afterparty-banner" href={paths.afterparty()}>
          <span class="afterparty-banner-text">
            <strong>OpenSauce Afterparty</strong>
            <span class="afterparty-banner-meta">
              Sun Jul 19 · 8PM · 272 Capp St
            </span>
          </span>
          <span class="afterparty-banner-cta">
            Tickets <span aria-hidden="true">→</span>
          </span>
          </a>*/}

        <MessageContainer messages={messages} />

        <section class="hero">
          <div>
            <div class="kicker">{"501(c)(3) · EST. 2007 · San Francisco"}</div>
            <h1 class="hero-title">
              Keep our
              <br />
              <span class="accent">lights on</span>,
              <br />
              doors open
              <span class="cursor"></span>
            </h1>
            <p class="hero-lede">
              Help keep our hackerspace running and accessible to everyone. Your
              contribution supports workshops, equipment, and a vibrant
              community of makers, thinkers, and tinkerers.
            </p>

            <div class="stat-row">
              <div class="stat">
                <div class="num">24/7</div>
                <div class="lbl">Doors open</div>
              </div>
              <div class="stat">
                <div class="num">$0</div>
                <div class="lbl">Membership required</div>
              </div>
              <div class="stat">
                <div class="num">100%</div>
                <div class="lbl">Volunteer-run</div>
              </div>
            </div>
          </div>

          <aside class="recurring-card">
            <div class="tag-row">
              <span>{"// supporting_member.sh"}</span>
              <span class="badge">Best impact</span>
            </div>
            <h2>Become a supporting member</h2>
            <p>
              Supporting members keep our lease, our internet, and our classes
              running without another fundraising sprint. Set your own monthly
              donation amount.
            </p>
            <Button
              variant="primary"
              arrow
              href={isAuthenticated ? paths.manage() : paths.signIn()}
            >
              {isAuthenticated
                ? "Manage your donation"
                : "Become a supporting member"}
            </Button>
          </aside>
        </section>

        <section>
          <SectionHead title="one_time_donation" anchor="donate" />

          <form id="donate-form" method="POST" action={paths.donate()}>
            <input type="hidden" name="_csrf" value={csrfToken} />
            <fieldset class="amount-grid">
              <legend class="visually-hidden">Donation amount</legend>

              <input
                type="radio"
                id="amount-10"
                name="amount-dollars"
                value="10"
                aria-label="$10"
                required
              />
              <label for="amount-10" class="amount-chip" aria-hidden="true">
                <span class="idx">[01]</span>
                <span class="amt">
                  <span class="dol">$</span>10
                </span>
              </label>

              <input
                type="radio"
                id="amount-20"
                name="amount-dollars"
                value="20"
                aria-label="$20"
              />
              <label for="amount-20" class="amount-chip" aria-hidden="true">
                <span class="idx">[02]</span>
                <span class="amt">
                  <span class="dol">$</span>20
                </span>
              </label>

              <input
                type="radio"
                id="amount-40"
                name="amount-dollars"
                value="40"
                aria-label="$40"
              />
              <label for="amount-40" class="amount-chip" aria-hidden="true">
                <span class="idx">[03]</span>
                <span class="amt">
                  <span class="dol">$</span>40
                </span>
              </label>

              <input
                type="radio"
                id="amount-80"
                name="amount-dollars"
                value="80"
                aria-label="$80"
              />
              <label for="amount-80" class="amount-chip" aria-hidden="true">
                <span class="idx">[04]</span>
                <span class="amt">
                  <span class="dol">$</span>80
                </span>
              </label>

              <input
                type="radio"
                id="amount-160"
                name="amount-dollars"
                value="160"
                aria-label="$160"
              />
              <label for="amount-160" class="amount-chip" aria-hidden="true">
                <span class="idx">[05]</span>
                <span class="amt">
                  <span class="dol">$</span>160
                </span>
              </label>

              <input
                type="radio"
                id="amount-custom"
                name="amount-dollars"
                value="custom"
                aria-label="Custom amount"
              />
              <label for="amount-custom" class="amount-chip" aria-hidden="true">
                <span class="idx">[06]</span>
                <span class="amt custom-label">Custom</span>
              </label>
            </fieldset>

            <div class="custom-amount">
              <label for="custom-amount" class="visually-hidden">
                Custom donation amount in dollars
              </label>
              <div class="custom-input-wrap">
                <span class="custom-input-label">Custom amount</span>
                <div class="custom-input-row">
                  <span class="dol">$</span>
                  <input
                    type="text"
                    inputmode="decimal"
                    id="custom-amount"
                    name="custom-amount"
                    placeholder="0"
                    aria-describedby="custom-amount-hint"
                    data-min={donationManager.MINIMUM_AMOUNT.cents / 100}
                    required
                    readonly
                  />
                </div>
              </div>
              <span id="custom-amount-hint" class="visually-hidden">
                Enter a custom dollar amount for your one-time donation
              </span>
            </div>

            <Button variant="primary" arrow type="submit" id="donate-now">
              Continue to payment
            </Button>
          </form>

          <div class="tax-note">
            Noisebridge is a 501(c)(3) tax-exempt nonprofit. Your donation is
            tax-deductible to the extent allowed by law. EIN{" "}
            <span class="ein">26-3507741</span>.
          </div>
        </section>
      </div>

      <StripeCheckoutModal title="Complete Your Donation" />
    </Layout>
  );
}
