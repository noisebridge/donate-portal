import { escapeHtml } from "@kitajs/html";
import { Layout } from "~/components/layout";
import paths from "~/lib/paths";
import type { TicketPaymentStatus } from "~/managers/ticketing";

export interface ThankYouProps {
  isTicket?: boolean;
  email?: string | undefined;
  ticketStatus?: TicketPaymentStatus | undefined;
  isAuthenticated: boolean;
  csrfToken?: string | undefined;
}

export function ThankYouPage({
  isTicket = false,
  email,
  ticketStatus = "succeeded",
  isAuthenticated,
  csrfToken,
}: ThankYouProps) {
  const title = !isTicket
    ? "Thank You!"
    : ticketStatus === "succeeded"
      ? "Tickets on the way"
      : ticketStatus === "processing"
        ? "Payment processing"
        : "Payment not complete";
  const retryPayment = isTicket && ticketStatus === "incomplete";

  return (
    <Layout
      title={title}
      styles="thank-you.css"
      isAuthenticated={isAuthenticated}
      csrfToken={csrfToken}
    >
      <section class="confirm">
        {isTicket && ticketStatus === "succeeded" ? (
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
        ) : isTicket && ticketStatus === "processing" ? (
          <>
            <h1 class="confirm-title">
              Payment processing.
              <br />
              <span class="accent">Watch your inbox.</span>
            </h1>

            <p class="confirm-lede">
              Stripe is still processing your payment. We’ll send your Open
              Sauce Afterparty tickets to{" "}
              {email ? (
                <strong class="accent">{escapeHtml(email)}</strong>
              ) : (
                "your email"
              )}{" "}
              as soon as it succeeds.
            </p>
          </>
        ) : isTicket ? (
          <>
            <h1 class="confirm-title">
              Payment not complete.
              <br />
              <span class="accent">No tickets issued.</span>
            </h1>

            <p class="confirm-lede">
              Your payment did not complete, so no tickets were issued. Return
              to the afterparty page to try again.
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
          <a
            href={retryPayment ? paths.afterparty() : paths.index()}
            class="btn btn-primary confirm-btn"
          >
            <span>{retryPayment ? "Try payment again" : "Back to site"}</span>
            <span class="arrow">←</span>
          </a>
        </div>
      </section>
    </Layout>
  );
}
