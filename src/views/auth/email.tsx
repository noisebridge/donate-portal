import { Layout } from "~/components/layout";

export interface AuthEmailProps {
  email: string;
  isAuthenticated: boolean;
}

export function AuthEmailPage({ email, isAuthenticated }: AuthEmailProps) {
  return (
    <Layout title="Check Your Email" isAuthenticated={isAuthenticated}>
      <div class="container-narrow">
        <div class="card text-center">
          <div class="page-icon-wrapper">
            <img
              class="page-icon"
              src="/assets/image/email.svg"
              alt="Email icon"
            />
          </div>

          <h1 class="page-title">Check your email</h1>

          <p class="page-message">
            We've sent a magic link to <strong>{email}</strong>
          </p>

          <p class="page-message-muted">
            This link is only valid for the next 5 minutes.
          </p>
        </div>
      </div>
    </Layout>
  );
}
