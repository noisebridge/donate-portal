import { escapeHtml } from "@kitajs/html";

interface StripeCheckoutModalProps {
  title: string;
  donateButton?: boolean;
}

export function StripeCheckoutModal({
  title,
  donateButton = true,
}: StripeCheckoutModalProps) {
  return (
    <div id="stripe-checkout-modal" class="checkout-modal" hidden>
      <div class="checkout-modal-backdrop"></div>
      <div class="checkout-modal-content">
        <button
          type="button"
          class="checkout-modal-close"
          aria-label="Close payment form"
        >
          &times;
        </button>
        <h2 class="checkout-modal-title">{escapeHtml(title)}</h2>
        <div id="payment-element"></div>
        <div id="payment-message" class="checkout-modal-message" hidden></div>
        {donateButton && (
          <button
            id="payment-submit"
            type="button"
            class="btn btn-secondary btn-large checkout-modal-submit"
          >
            Donate Now
          </button>
        )}
      </div>
    </div>
  );
}
