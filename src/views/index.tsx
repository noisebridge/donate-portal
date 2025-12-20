// biome-ignore lint/correctness/noUnusedImports: Html is used by JSX
import Html from "@kitajs/html";
import { ErrorBanner } from "~/components/error-banner";
import { Layout } from "~/components/layout";

export interface IndexProps {
  isAuthenticated: boolean;
  error?: string | undefined;
}

export function IndexPage({ isAuthenticated, error }: IndexProps) {
  return (
    <Layout
      title="Donate to Noisebridge!"
      script="index.mjs"
      styles="index.css"
      isAuthenticated={isAuthenticated}
    >
      <section class="hero">
        <h1>Support Noisebridge</h1>
        <p>
          All donations are tax-deductible. Noisebridge is a 501(c)(3)
          non-profit.
        </p>
      </section>

      <ErrorBanner error={error} />

      <div class="card">
        <h2>Monthly Donation</h2>
        <p>
          Help keep our hackerspace running and accessible to everyone. Your
          contribution supports workshops, equipment, and a vibrant community of
          makers, thinkers, and tinkerers.
        </p>
        <a
          class="btn btn-primary btn-large"
          href={isAuthenticated ? "/manage" : "/auth"}
        >
          {isAuthenticated
            ? "Manage Your Donation"
            : "Start Membership Donation"}
        </a>
      </div>

      <div class="card">
        <h2>One-Time Donation</h2>
        <p>Make a single contribution to support Noisebridge.</p>

        <form method="POST" action="/donate">
          <div class="amount-buttons">
            <input
              type="radio"
              id="amount-10"
              name="amount-dollars"
              value="10"
            />
            <label for="amount-10" class="btn btn-amount">
              $10
            </label>

            <input
              type="radio"
              id="amount-20"
              name="amount-dollars"
              value="20"
            />
            <label for="amount-20" class="btn btn-amount">
              $20
            </label>

            <input
              type="radio"
              id="amount-40"
              name="amount-dollars"
              value="40"
            />
            <label for="amount-40" class="btn btn-amount">
              $40
            </label>

            <input
              type="radio"
              id="amount-80"
              name="amount-dollars"
              value="80"
            />
            <label for="amount-80" class="btn btn-amount">
              $80
            </label>

            <input
              type="radio"
              id="amount-160"
              name="amount-dollars"
              value="160"
            />
            <label for="amount-160" class="btn btn-amount">
              $160
            </label>

            <input
              type="radio"
              id="amount-custom"
              name="amount-dollars"
              value="custom"
            />
            <label for="amount-custom" class="btn btn-amount">
              Custom
            </label>
          </div>

          <div class="custom-amount">
            <div class="input-group">
              <span class="input-prefix">$</span>
              <input
                type="text"
                inputmode="numeric"
                id="custom-amount"
                name="custom-amount"
                placeholder="0.00"
                min="2.00"
                step="0.01"
                disabled
              />
            </div>
          </div>

          <button
            id="donate-now"
            class="btn btn-secondary btn-large"
            type="submit"
            disabled
          >
            Donate Now
          </button>
        </form>
      </div>
    </Layout>
  );
}
