import { Layout } from "~/components/layout";
import paths from "~/paths";

export interface ThankYouProps {
  isAuthenticated: boolean;
}

export function ThankYouPage({ isAuthenticated }: ThankYouProps) {
  return (
    <Layout title="Thank You!" isAuthenticated={isAuthenticated}>
      <div class="container-narrow">
        <div class="card text-center">
          <div class="page-icon-wrapper">
            <img
              class="page-icon"
              src="/assets/image/checkmark.svg"
              alt="Success checkmark"
            />
          </div>

          <h1 class="page-title">Thank you for your donation!</h1>

          <p class="page-message">
            Your support helps keep Noisebridge running and accessible to
            everyone.
          </p>

          <a href={paths.index()} class="btn btn-primary btn-large">
            Return to Home
          </a>
        </div>
      </div>
    </Layout>
  );
}
