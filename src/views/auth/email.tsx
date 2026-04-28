import { escapeHtml } from "@kitajs/html";
import { Layout } from "~/components/layout";
import { StatusCard } from "~/components/status-card";

export interface AuthEmailProps {
  email: string;
  isAuthenticated: boolean;
}

export function AuthEmailPage({ email, isAuthenticated }: AuthEmailProps) {
  return (
    <Layout title="Check Your Email" isAuthenticated={isAuthenticated}>
      <StatusCard
        icon={
          <img
            class="page-icon"
            src="/assets/image/email.svg"
            alt="Email icon"
          />
        }
        title="Check your email"
      >
        <p class="page-message">
          We've sent a magic link to <strong>{escapeHtml(email)}</strong>
        </p>

        <p class="page-message-muted">
          This link is only valid for the next 5 minutes.
        </p>
      </StatusCard>
    </Layout>
  );
}
