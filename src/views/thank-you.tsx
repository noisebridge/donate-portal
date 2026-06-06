import { Layout } from "~/components/layout";
import paths from "~/lib/paths";

export interface ThankYouProps {
  isAuthenticated: boolean;
  csrfToken?: string | undefined;
}

export function ThankYouPage({ isAuthenticated, csrfToken }: ThankYouProps) {
  return (
    <Layout
      title="Thank You!"
      styles="thank-you.css"
      isAuthenticated={isAuthenticated}
      csrfToken={csrfToken}
    >
      <section class="confirm">
        <h1 class="confirm-title">
          Thank you,
          <br />
          <span class="accent">you keep us running.</span>
        </h1>

        <p class="confirm-lede">
          Your gift keeps Noisebridge alive. We depend on people like you to
          continue serving the public without any outside influences.
        </p>

        <div class="confirm-actions">
          <a href={paths.index()} class="btn btn-primary confirm-btn">
            <span>Back to site</span>
            <span class="arrow">←</span>
          </a>
        </div>
      </section>
    </Layout>
  );
}
