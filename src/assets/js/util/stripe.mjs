// @ts-check

import { sendErrorReport } from "./error-reporting.mjs";

/** @typedef {import("@stripe/stripe-js").ReleaseTrain} StripeRelease */
/** @typedef {import("@stripe/stripe-js").Stripe} Stripe */
/** @typedef {import("@stripe/stripe-js").StripeElements} StripeElements */
/** @typedef {import("~/lib/paths").Paths} Paths */

/** @satisfies {Paths['thankYou']} */
const THANK_YOU_PATH = "/thank-you";

/**
 * Release code-name, type-checked for alignment with the `@stripe/stripe-js`
 * npm module which is used only for type imports.
 * @satisfies {StripeRelease}
 */
const RELEASE = "dahlia";
/** @type {Promise<Stripe> | null} */
let stripePromise = null;

/** @type {StripeElements | null} */
let elements = null;

/**
 * Replace a button's content with animated loading bars.
 * @param {HTMLButtonElement} button
 * @returns {() => void} A function that restores the original content.
 */
export function startLoading(button) {
  const originalHTML = button.innerHTML;

  button.disabled = true;
  button.innerHTML = "";

  const wrap = document.createElement("div");
  wrap.className = "loading-block-wrap";
  for (let i = 0; i < 5; i++) {
    const bar = document.createElement("div");
    bar.className = "loading-block-bar";
    wrap.appendChild(bar);
  }
  button.appendChild(wrap);

  return () => {
    button.innerHTML = originalHTML;
    button.disabled = false;
  };
}

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
    script.src = `https://js.stripe.com/${RELEASE}/stripe.js`;

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

/** @type {(() => void) | null} */
let modalOnClose = null;

/**
 * @param {() => void} onClose
 */
function showModal(onClose) {
  const modal = document.getElementById("stripe-checkout-modal");
  if (!modal) return;

  modal.hidden = false;
  document.body.style.overflow = "hidden";
  modalOnClose = onClose;
}

function hideModal() {
  const modal = document.getElementById("stripe-checkout-modal");
  if (!modal) return;

  modal.hidden = true;
  document.body.style.overflow = "";
  if (modalOnClose) {
    modalOnClose();
    modalOnClose = null;
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
          return_url: `${window.location.origin}${THANK_YOU_PATH}`,
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
 * @param {string | null} email - Email to prefill for Stripe Link and billing details.
 */
export async function initDonationCheckout(clientSecret, email) {
  const stripe = await initStripe();
  elements = stripe.elements({ clientSecret });

  const paymentElement = elements.create("payment", {
    layout: {
      type: "accordion",
      defaultCollapsed: false,
      radios: "if_multiple",
      spacedAccordionItems: true,
    },
    paymentMethodOrder: ["apple_pay", "google_pay", "card", "crypto"],
    ...(email ? { defaultValues: { billingDetails: { email } } } : {}),
  });
  paymentElement.on("escape", () => hideModal());
  paymentElement.on("loaderror", ({ error }) => showError(error.message ?? ""));

  const mountPoint = document.getElementById("payment-element");
  if (mountPoint) {
    paymentElement.mount(mountPoint);
  }

  showModal(() => {
    paymentElement.destroy();
    elements = null;
  });
}

/**
 * Open the checkout modal with Stripe Embedded Checkout for subscriptions.
 * @param {string} clientSecret - Checkout Session client secret
 */
export async function initSubscriptionCheckout(clientSecret) {
  const stripe = await initStripe();

  const mountPoint = document.getElementById("payment-element");
  if (!mountPoint) {
    return;
  }

  const embeddedCheckout = await stripe.createEmbeddedCheckoutPage({
    clientSecret,
  });
  embeddedCheckout.mount(mountPoint);

  showModal(() => {
    embeddedCheckout.destroy();
  });
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
 * @property {string} clientSecret
 * @property {string | null} emailAddress
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
  if (typeof clientSecret !== "string") {
    console.debug("Response contains an invalid clientSecret:", clientSecret);
    return false;
  }

  if (!("emailAddress" in data)) {
    console.debug("Response does not contain an emailAddress:", data);
    return false;
  }

  const emailAddress = data["emailAddress"];
  if (emailAddress !== null && typeof emailAddress !== "string") {
    console.debug("Response contains an invalid emailAddress:", emailAddress);
    return false;
  }

  return true;
}

/**
 * @param {HTMLFormElement} form
 * @param {"donate" | "subscribe"} type
 */
export function initCheckoutForm(form, type) {
  const submitBtn = /** @type {HTMLButtonElement | null} */ (
    form.querySelector('button[type="submit"]')
  );
  if (!submitBtn) {
    console.error("Could not find a submit button");
    return;
  }

  initCheckoutModal();

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const stopLoading = startLoading(submitBtn);

    /** @type {Response} */
    let response;
    try {
      response = await fetch(form.action, {
        method: "POST",
        headers: {
          Accept: "application/json",
        },
        body: new URLSearchParams(Array.from(new FormData(form).entries())),
        signal: AbortSignal.timeout(10000),
      });
    } catch (e) {
      console.error("Failed to initiate donation:", e);
      stopLoading();

      if (e instanceof Error) {
        sendErrorReport(e);
      }
      return;
    }

    if (!response.ok) {
      console.error(`Error response from ${form.action}:`, response.statusText);
      stopLoading();
      return;
    }

    const data = await response.json();
    if (isRedirectData(data)) {
      window.location.href = data.redirect;
    } else if (isCheckoutData(data)) {
      if (type === "donate") {
        await initDonationCheckout(data.clientSecret, data.emailAddress);
      } else if (type === "subscribe") {
        await initSubscriptionCheckout(data.clientSecret);
      }
    } else {
      console.error("Response contains invalid data:", data);
    }

    stopLoading();
  });
}
