import { Button } from "~/components/button";
import { Layout } from "~/components/layout";
import { StatusCard } from "~/components/status-card";
import paths from "~/paths";

export interface ThankYouProps {
  isAuthenticated: boolean;
  csrfToken?: string | undefined;
}

export function ThankYouPage({ isAuthenticated, csrfToken }: ThankYouProps) {
  return (
    <Layout
      title="Thank You!"
      isAuthenticated={isAuthenticated}
      csrfToken={csrfToken}
    >
      <StatusCard
        icon={
          <img
            class="page-icon"
            src="/assets/image/checkmark.svg"
            alt="Success checkmark"
          />
        }
        title="Donation Complete!"
      >
        <p class="page-message">
          Your support helps keep Noisebridge running and accessible to
          everyone.
        </p>

        <Button variant="primary" href={paths.index()}>
          Return Home
        </Button>
      </StatusCard>
    </Layout>
  );
}
