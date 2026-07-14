// @ts-check

import { formatAmount } from "./util/money-forms.mjs";
import { initCheckoutForm } from "./util/stripe.mjs";
import {
  dollarPattern,
  enforcePattern,
  validateMinAmount,
} from "./util/validate.mjs";

/** @typedef {import("~/types/cents").Cents} Cents */

const MIN_QUANTITY = 1;

/** @type {import("@stripe/stripe-js").Appearance} */
const STRIPE_APPEARANCE = {
  disableAnimations: true,
  theme: "flat",
  variables: {
    colorPrimary: "#000000",
    colorBackground: "#ff0000",
    colorText: "#000000",
    colorSuccess: "#000000",
    colorDanger: "#000000",
    colorWarning: "#000000",
    colorTextSecondary: "#000000",
    colorTextPlaceholder: "#000000",
    accessibleColorOnColorPrimary: "#ff0000",
    accessibleColorOnColorBackground: "#000000",
    accessibleColorOnColorSuccess: "#ff0000",
    accessibleColorOnColorDanger: "#ff0000",
    accessibleColorOnColorWarning: "#ff0000",
    iconColor: "#000000",
    iconHoverColor: "#000000",
    inputColorBorder: "#000000",
    inputFocusColorBorder: "#000000",
    focusBoxShadow: "0 0 0 2px #000000",
    borderRadius: "0px",
  },
};

/**
 * Wire up the quantity stepper (minus / plus buttons and the editable field),
 * the editable price and the receipt so they stay in sync and keep the submit
 * button label current.
 */
function initTicketControls() {
  const priceInput = /** @type {HTMLInputElement | null} */ (
    document.getElementById("price-input")
  );
  const qtyInput = /** @type {HTMLInputElement | null} */ (
    document.getElementById("qty-input")
  );
  const qtyMinus = /** @type {HTMLButtonElement | null} */ (
    document.getElementById("qty-minus")
  );
  const qtyPlus = /** @type {HTMLButtonElement | null} */ (
    document.getElementById("qty-plus")
  );
  const qtySub = document.getElementById("qty-sub");
  const continueLabel = document.getElementById("continue-label");
  if (
    !priceInput ||
    !qtyInput ||
    !qtyMinus ||
    !qtyPlus ||
    !qtySub ||
    !continueLabel
  ) {
    return;
  }

  enforcePattern(priceInput, dollarPattern);
  validateMinAmount(priceInput);

  const min = parseFloat(priceInput.dataset["min"] ?? "") || 0;
  const maxQuantity =
    parseInt(qtyInput.dataset["max"] ?? "", 10) || MIN_QUANTITY;
  const minimumPaidTotalCents =
    parseInt(priceInput.dataset["minimumPaidTotalCents"] ?? "", 10) || 0;
  /** @type {Cents} */
  const price = { cents: Math.round(parseFloat(priceInput.value) * 100) };
  let quantity = Math.min(
    maxQuantity,
    Math.max(MIN_QUANTITY, parseInt(qtyInput.value, 10) || MIN_QUANTITY),
  );

  const render = () => {
    qtyMinus.disabled = quantity <= MIN_QUANTITY;
    qtyPlus.disabled = quantity >= maxQuantity;
    qtyInput.setAttribute("aria-valuenow", String(quantity));
    qtySub.textContent = quantity === 1 ? "ticket" : "tickets";

    /** @type {Cents} */
    const total = { cents: price.cents * quantity };
    priceInput.setCustomValidity(
      total.cents > 0 && total.cents < minimumPaidTotalCents
        ? "Enter $0 or an amount that totals at least $0.50"
        : "",
    );
    const free = total.cents === 0;
    continueLabel.textContent = free
      ? `Get ${quantity} free ${quantity === 1 ? "ticket" : "tickets"}`
      : `Pay ${formatAmount(total)} - Get ${quantity} ${quantity === 1 ? "ticket" : "tickets"}`;
  };

  /** @param {number} dollars */
  const setPrice = (dollars) => {
    price.cents = Math.round(dollars * 100);
    priceInput.value = dollars.toFixed(2);
    render();
  };

  /** @param {number} next */
  const setQuantity = (next) => {
    quantity = Math.min(maxQuantity, Math.max(MIN_QUANTITY, Math.round(next)));
    qtyInput.value = String(quantity);
    render();
  };

  priceInput.addEventListener("input", () => {
    const dollars = parseFloat(priceInput.value);
    if (Number.isNaN(dollars)) {
      // Keep the last valid amount so blur restores it instead of "NaN".
      return;
    }
    price.cents = Math.round(dollars * 100);
    render();
  });
  priceInput.addEventListener("blur", () => {
    const dollars = parseFloat(priceInput.value);
    setPrice(Number.isNaN(dollars) || dollars < min ? min : dollars);
  });

  qtyMinus.addEventListener("click", () => setQuantity(quantity - 1));
  qtyPlus.addEventListener("click", () => setQuantity(quantity + 1));
  qtyInput.addEventListener("input", () => {
    const next = parseInt(qtyInput.value, 10);
    if (!Number.isNaN(next)) {
      setQuantity(next);
    }
  });
  qtyInput.addEventListener("blur", () => setQuantity(quantity));

  render();
}

document.addEventListener("DOMContentLoaded", () => {
  initTicketControls();

  const form = /** @type {HTMLFormElement | null} */ (
    document.getElementById("afterparty-form")
  );
  if (form) {
    initCheckoutForm(form, "donate", STRIPE_APPEARANCE);
  }
});
