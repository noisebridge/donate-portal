import { escapeHtml } from "@kitajs/html";
import { assetPath } from "~/assets";
import { Layout } from "~/components/layout";
import { StatusCard } from "~/components/status-card";

export interface AuthEmailProps {
  email: string;
  isAuthenticated: boolean;
  csrfToken?: string | undefined;
}

export function AuthEmailPage({
  email,
  isAuthenticated,
  csrfToken,
}: AuthEmailProps) {
  return (
    <Layout
      title="Check Your Email"
      isAuthenticated={isAuthenticated}
      csrfToken={csrfToken}
    >
      <StatusCard
        icon={
          <img
            class="page-icon"
            src={assetPath("image/email.svg")}
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
