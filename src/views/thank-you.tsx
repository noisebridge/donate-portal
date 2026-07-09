import { escapeHtml } from "@kitajs/html";
import { Layout } from "~/components/layout";
import paths from "~/lib/paths";

export interface ThankYouProps {
  isTicket?: boolean;
  email?: string | undefined;
  isAuthenticated: boolean;
  csrfToken?: string | undefined;
}

export function ThankYouPage({
  isTicket = false,
  email,
  isAuthenticated,
  csrfToken,
}: ThankYouProps) {
  return (
    <Layout
      title={isTicket ? "Tickets on the way" : "Thank You!"}
      styles="thank-you.css"
      isAuthenticated={isAuthenticated}
      csrfToken={csrfToken}
    >
      <section class="confirm">
        {isTicket ? (
          <>
            <h1 class="confirm-title">
              You're in.
              <br />
              <span class="accent">Check your inbox.</span>
            </h1>

            <p class="confirm-lede">
              {email ? (
                <>
                  Your Open Sauce Afterparty tickets are on their way to{" "}
                  <strong class="accent">{escapeHtml(email)}</strong>.
                </>
              ) : (
                <>
                  Your Open Sauce Afterparty tickets are on their way to your
                  email.
                </>
              )}
            </p>
          </>
        ) : (
          <>
            <h1 class="confirm-title">
              Thank you,
              <br />
              <span class="accent">you keep us running.</span>
            </h1>

            <p class="confirm-lede">
              Your gift keeps Noisebridge alive. We depend on people like you to
              continue serving the public without any outside influences.
            </p>
          </>
        )}

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
