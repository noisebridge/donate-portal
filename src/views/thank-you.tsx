// biome-ignore lint/correctness/noUnusedImports: Html is used by JSX
import Html from "@kitajs/html";
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
      <section class="thank-you-container">
        <div class="thank-you-card">
          <div class="thank-you-icon-wrapper">
            <img
              class="thank-you-icon"
              src="/assets/image/checkmark.svg"
              alt="Success checkmark"
            />
          </div>

          <h1 class="thank-you-title">Thank you for your donation!</h1>

          <p class="thank-you-message">
            Your support helps keep Noisebridge running and accessible to everyone.
          </p>

          <p class="thank-you-secondary">
            You'll receive a receipt via email shortly.
          </p>

          <a href="/" class="btn btn-primary btn-large">Return to Home</a>
        </div>
      </section>
    </Layout>
  );
}
