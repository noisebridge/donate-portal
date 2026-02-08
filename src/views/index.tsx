import { Layout } from "~/components/layout";
import { type Message, MessageContainer } from "~/components/message-container";
import { DonationManager } from "~/managers/donation";
import paths from "~/paths";

export interface IndexProps {
  isAuthenticated: boolean;
  messages?: Message[];
}

export function IndexPage({ isAuthenticated, messages = [] }: IndexProps) {
  return (
    <Layout
      title="Donate to Noisebridge!"
      script="index.mjs"
      styles="index.css"
      isAuthenticated={isAuthenticated}
    >
      <div class="container">
        <section class="hero">
          <h1>Support Noisebridge</h1>
          <p>
            All donations are tax-deductible. Noisebridge is a 501(c)(3)
            non-profit.
          </p>
        </section>

        <MessageContainer messages={messages} />

        <div class="card">
          <h2>Monthly Donation</h2>
          <p>
            Help keep our hackerspace running and accessible to everyone. Your
            contribution supports workshops, equipment, and a vibrant community
            of makers, thinkers, and tinkerers.
          </p>
          <a
            class="btn btn-primary btn-large"
            href={isAuthenticated ? paths.manage() : paths.signIn()}
          >
            {isAuthenticated
              ? "Manage Your Donation"
              : "Start Membership Donation"}
          </a>
        </div>

        <div class="card">
          <h2>One-Time Donation</h2>
          <p>Make a single contribution to support Noisebridge.</p>

          <form method="POST" action={paths.donate()}>
            <fieldset class="amount-buttons">
              <legend class="visually-hidden">Donation amount</legend>
              <input
                type="radio"
                id="amount-10"
                name="amount-dollars"
                value="10"
                aria-label="$10"
                required
              />
              <label for="amount-10" class="btn btn-amount" aria-hidden="true">
                $10
              </label>

              <input
                type="radio"
                id="amount-20"
                name="amount-dollars"
                value="20"
                aria-label="$20"
              />
              <label for="amount-20" class="btn btn-amount" aria-hidden="true">
                $20
              </label>

              <input
                type="radio"
                id="amount-40"
                name="amount-dollars"
                value="40"
                aria-label="$40"
              />
              <label for="amount-40" class="btn btn-amount" aria-hidden="true">
                $40
              </label>

              <input
                type="radio"
                id="amount-80"
                name="amount-dollars"
                value="80"
                aria-label="$80"
              />
              <label for="amount-80" class="btn btn-amount" aria-hidden="true">
                $80
              </label>

              <input
                type="radio"
                id="amount-160"
                name="amount-dollars"
                value="160"
                aria-label="$160"
              />
              <label for="amount-160" class="btn btn-amount" aria-hidden="true">
                $160
              </label>

              <input
                type="radio"
                id="amount-custom"
                name="amount-dollars"
                value="custom"
                aria-label="Custom amount"
              />
              <label
                for="amount-custom"
                class="btn btn-amount"
                aria-hidden="true"
              >
                Custom
              </label>
            </fieldset>

            <div class="custom-amount">
              <label for="custom-amount" class="visually-hidden">
                Custom donation amount in dollars
              </label>
              <div class="input-group">
                <span class="input-prefix" aria-hidden="true">
                  $
                </span>
                <input
                  type="text"
                  inputmode="numeric"
                  id="custom-amount"
                  name="custom-amount"
                  placeholder="0.00"
                  aria-describedby="custom-amount-hint"
                  data-min={DonationManager.minimumAmount.cents / 100}
                  required
                  readonly
                />
              </div>
              <span id="custom-amount-hint" class="visually-hidden">
                Enter a custom dollar amount for your one-time donation
              </span>
            </div>

            <button
              id="donate-now"
              class="btn btn-secondary btn-large"
              type="submit"
            >
              Donate Now
            </button>
          </form>
        </div>
      </div>
    </Layout>
  );
}
