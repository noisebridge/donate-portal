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
  const continueLabel = document.getElementById("continue-label");
  if (!priceInput || !qtyInput || !qtyMinus || !qtyPlus || !continueLabel) {
    return;
  }

  enforcePattern(priceInput, dollarPattern);
  validateMinAmount(priceInput);

  const min = parseFloat(priceInput.dataset["min"] ?? "") || 0;
  const maxQuantity =
    parseInt(qtyInput.dataset["max"] ?? "", 10) || MIN_QUANTITY;
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
    /** @type {Cents} */
    const total = { cents: price.cents * quantity };
    continueLabel.textContent = `Pay ${formatAmount(total)} - Get ${quantity} ${quantity === 1 ? "ticket" : "tickets"}`;
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

  const form = /** @type {HTMLFormElement} */ (
    document.getElementById("afterparty-form")
  );
  initCheckoutForm(form, "donate");
});
