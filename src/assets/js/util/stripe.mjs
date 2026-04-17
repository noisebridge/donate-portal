// @ts-check

import { sendErrorReport } from "./error-reporting.mjs";

/** @typedef {import("@stripe/stripe-js").Stripe} Stripe */
/** @typedef {import("@stripe/stripe-js").StripeElements} StripeElements */
/** @typedef {import("@stripe/stripe-js").StripeElementType} StripeElementType */
/** @typedef {import("@stripe/stripe-js").StripeEmbeddedCheckout} StripeEmbeddedCheckout */

/** @satisfies {StripeElementType} */
const ELEMENT_TYPE = "payment";

/** @type {Promise<Stripe> | null} */
let stripePromise = null;

/** @type {StripeElements | null} */
let elements = null;

/** @type {StripeEmbeddedCheckout | null} */
let embeddedCheckout = null;

/**
 * Extract Stripe public key from the DOM.
 */
function getStripeKey() {
  const stripeKeyTag = /** @type {HTMLMetaElement | null} */ (
    document.querySelector("meta[name='stripe-public']")
  );
  if (!stripeKeyTag) {
    throw new Error("Stripe public key not found");
  }

  return stripeKeyTag.content;
}

/**
 * Loads the Stripe.js script and resolves with the Stripe constructor.
 * Subsequent calls return the same promise.
 * @returns {Promise<Stripe>}
 */
export function initStripe() {
  if (stripePromise) {
    return stripePromise;
  }

  const stripeKey = getStripeKey();

  stripePromise = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://js.stripe.com/dahlia/stripe.js";

    script.addEventListener("load", () => {
      if (!window.Stripe) {
        stripePromise = null;
        reject(new Error("Stripe.js loaded but window.Stripe is undefined"));
        return;
      }

      resolve(window.Stripe(stripeKey));
    });

    script.addEventListener("error", (event) => {
      stripePromise = null;
      reject(event.error);
    });

    document.head.appendChild(script);
  });

  return stripePromise;
}

function showModal() {
  const modal = document.getElementById("stripe-checkout-modal");
  if (modal) {
    modal.hidden = false;
    document.body.style.overflow = "hidden";
  }
}

function hideModal() {
  const modal = document.getElementById("stripe-checkout-modal");
  if (modal) {
    modal.hidden = true;
    document.body.style.overflow = "";
  }

  if (elements) {
    elements.getElement(ELEMENT_TYPE)?.destroy();
    elements = null;
  }

  if (embeddedCheckout) {
    embeddedCheckout.destroy();
    embeddedCheckout = null;
  }
}

/** @param {string} message */
function showError(message) {
  const el = document.getElementById("payment-message");
  if (el) {
    el.textContent = message;
    el.hidden = false;
  }
}

function hideError() {
  const el = document.getElementById("payment-message");
  if (el) {
    el.hidden = true;
    el.textContent = "";
  }
}

/** @param {boolean} loading */
function setLoading(loading) {
  const submitBtn = /** @type {HTMLButtonElement | null} */ (
    document.getElementById("payment-submit")
  );
  if (submitBtn) {
    submitBtn.disabled = loading;
  }
}

/**
 * Initialize the checkout modal controls (close button, backdrop, Escape key)
 * and the payment submit button.
 */
function initCheckoutModal() {
  const closeBtn = document.querySelector(".checkout-modal-close");
  closeBtn?.addEventListener("click", hideModal);

  const backdrop = document.querySelector(".checkout-modal-backdrop");
  backdrop?.addEventListener("click", hideModal);

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      hideModal();
    }
  });

  const submitBtn = document.getElementById("payment-submit");
  if (submitBtn) {
    submitBtn.addEventListener("click", async () => {
      if (!elements) {
        return;
      }

      setLoading(true);
      hideError();

      const stripe = await initStripe();
      const { error } = await stripe.confirmPayment({
        elements,
        confirmParams: {
          return_url: `${window.location.origin}/thank-you`,
        },
      });

      if (error) {
        showError(error.message || "Payment failed. Please try again.");
        setLoading(false);
      }
    });
  }
}

/**
 * Open the checkout modal with a Stripe Payment Element for the given client secret.
 * @param {string} clientSecret
 */
export async function openCheckoutModal(clientSecret) {
  const stripe = await initStripe();
  elements = stripe.elements({ clientSecret });

  const paymentElement = elements.create(ELEMENT_TYPE, {
    layout: {
      type: "accordion",
      defaultCollapsed: false,
      radios: "if_multiple",
      spacedAccordionItems: true,
    },
    paymentMethodOrder: ["apple_pay", "google_pay", "card", "crypto"],
  });

  const mountPoint = document.getElementById("payment-element");
  if (mountPoint) {
    paymentElement.mount(mountPoint);
  }

  showModal();
}

/**
 * Open the checkout modal with Stripe Embedded Checkout for subscriptions.
 * @param {string} clientSecret - Checkout Session client secret
 */
export async function openEmbeddedCheckout(clientSecret) {
  const stripe = await initStripe();

  const mountPoint = document.getElementById("payment-element");
  if (!mountPoint) {
    return;
  }

  embeddedCheckout = await stripe.createEmbeddedCheckoutPage({ clientSecret });
  embeddedCheckout.mount(mountPoint);

  showModal();
}

/**
 * @typedef {Object} RedirectData
 * @property {string} redirect - Redirect URL
 */

/**
 *
 * @param {unknown} data
 * @returns {data is RedirectData}
 */
function isRedirectData(data) {
  if (typeof data !== "object" || Array.isArray(data) || data === null) {
    console.debug("Response is not an object:", data);
    return false;
  }

  if (!("redirect" in data)) {
    console.debug("Response does not contain a redirect:", data);
    return false;
  }

  const redirect = data["redirect"];
  if (typeof redirect !== "string") {
    console.debug("Response contains an invalid redirect:", redirect);
    return false;
  }

  return true;
}

/**
 * @typedef {Object} CheckoutData
 * @property {string} [clientSecret]
 */

/**
 * @param {unknown} data
 * @returns {data is CheckoutData}
 */
function isCheckoutData(data) {
  if (typeof data !== "object" || Array.isArray(data) || data === null) {
    console.debug("Response is not an object:", data);
    return false;
  }

  if (!("clientSecret" in data)) {
    console.debug("Response does not contain a clientSecret:", data);
    return false;
  }

  const clientSecret = data["clientSecret"];
  if (typeof clientSecret !== "undefined" && typeof clientSecret !== "string") {
    console.debug("Response contains an invalid clientSecret:", clientSecret);
    return false;
  }

  return true;
}

/**
 * @param {HTMLFormElement} form
 * @param {(clientSecret?: string) => Promise<void>} onSuccess
 */
export function initCheckoutForm(form, onSuccess) {
  initCheckoutModal();

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    /** @type {Response} */
    let response;
    try {
      response = await fetch(form.action, {
        method: "POST",
        headers: {
          Accept: "application/json",
        },
        body: new URLSearchParams(Array.from(new FormData(form).entries())),
      });
    } catch (e) {
      console.error("Failed to initiate donation:", e);

      if (e instanceof Error) {
        sendErrorReport(e);
      }
      return;
    }

    if (!response.ok) {
      console.error(`Error response from ${form.action}:`, response.statusText);
      return;
    }

    const data = await response.json();
    if (isRedirectData(data)) {
      window.location.href = data.redirect;
    } else if (isCheckoutData(data)) {
      await onSuccess(data.clientSecret);
    } else {
      console.error("Response contains invalid data:", data);
    }
  });
}
