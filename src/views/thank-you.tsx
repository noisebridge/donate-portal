import { Layout } from "~/components/layout";

export interface ThankYouProps {
  isAuthenticated: boolean;
}

export function ThankYouPage({ isAuthenticated }: ThankYouProps) {
  return (
    <Layout
      title="Thank You!"
      styles="thank-you.css"
      isAuthenticated={isAuthenticated}
    >
      <div class="container-narrow">
        <div class="card text-center">
          <div class="thank-you-icon-wrapper">
            <img
              class="thank-you-icon"
              src="/assets/image/checkmark.svg"
              alt="Success checkmark"
            />
          </div>

          <h1 class="thank-you-title">Thank you for your donation!</h1>

          <p class="thank-you-message">
            Your support helps keep Noisebridge running and accessible to
            everyone.
          </p>

          <a href="/" class="btn btn-primary btn-large">
            Return to Home
          </a>
        </div>
      </div>
    </Layout>
  );
}
