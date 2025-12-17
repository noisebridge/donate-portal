// biome-ignore lint/correctness/noUnusedImports: Html is used by JSX
import Html from "@kitajs/html";
import { Layout } from "~/components/layout";

export interface AuthEmailProps {
  email: string;
  isAuthenticated: boolean;
}

export function AuthEmailPage({ email, isAuthenticated }: AuthEmailProps) {
  return (
    <Layout
      title="Check Your Email"
      styles="auth-email.css"
      isAuthenticated={isAuthenticated}
    >
      <section class="email-waiting-container">
        <div class="email-waiting-card">
          <div class="email-icon-wrapper">
            <img
              class="email-icon"
              src="/assets/image/email.svg"
              alt="Email icon"
            />
          </div>

          <h1 class="email-waiting-title">Check your email</h1>

          <p class="email-waiting-message">
            We've sent a magic link to <strong>{email}</strong>
          </p>

          <p class="email-waiting-expiry">
            This link is only valid for the next 5 minutes.
          </p>
        </div>
      </section>
    </Layout>
  );
}
