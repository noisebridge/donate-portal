// @ts-check

import { formatAmount } from "./util/money-forms.mjs";
import { initSliderTicks } from "./util/slider.mjs";
import { initCheckoutForm } from "./util/stripe.mjs";
import {
  dollarPattern,
  enforcePattern,
  validateMinAmount,
} from "./util/validate.mjs";

/** @typedef {import("~/types/cents").Cents} Cents */

const MIN_QUANTITY = 1;
const MAX_QUANTITY = 20;

/**
 * Wire up the quantity stepper (minus / plus buttons and the editable field),
 * the price slider / input / preset ticks and the receipt so they all stay in
 * sync and keep the submit button label current.
 */
function initTicketControls() {
  const slider = /** @type {HTMLInputElement | null} */ (
    document.getElementById("price-slider")
  );
  const priceInput = /** @type {HTMLInputElement | null} */ (
    document.getElementById("price-input")
  );
  const priceTag = document.getElementById("price-tag");
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
  const receiptCalc = document.getElementById("receipt-calc");
  const totalAmt = document.getElementById("total-amt");
  const continueLabel = document.getElementById("continue-label");
  if (
    !slider ||
    !priceInput ||
    !priceTag ||
    !qtyInput ||
    !qtyMinus ||
    !qtyPlus ||
    !qtySub ||
    !receiptCalc ||
    !totalAmt ||
    !continueLabel
  ) {
    return;
  }

  enforcePattern(priceInput, dollarPattern);
  validateMinAmount(priceInput);

  const min = parseFloat(slider.min) || 0;
  const max = parseFloat(slider.max) || 0;
  const suggested = parseFloat(priceInput.value) || min;

  /** @type {Cents} */
  const price = { cents: Math.round(parseFloat(priceInput.value) * 100) };
  let quantity = Math.min(
    MAX_QUANTITY,
    Math.max(MIN_QUANTITY, parseInt(qtyInput.value, 10) || MIN_QUANTITY),
  );

  const render = () => {
    const dollars = price.cents / 100;

    // Keep slider handle within its track bounds even for typed-in prices that
    // exceed the max.
    slider.value = String(Math.min(max, Math.max(min, dollars)));

    // Price tag hints whether the buyer is under, at, or over the suggestion.
    priceTag.classList.remove("low", "high");
    if (dollars < suggested) {
      priceTag.textContent = "pay-what-you-can";
      priceTag.classList.add("low");
    } else if (dollars > suggested) {
      priceTag.textContent = `+${formatAmount({ cents: price.cents - Math.round(suggested * 100) })} extra`;
      priceTag.classList.add("high");
    } else {
      priceTag.textContent = "suggested";
    }

    qtyMinus.disabled = quantity <= MIN_QUANTITY;
    qtyPlus.disabled = quantity >= MAX_QUANTITY;
    qtySub.textContent = quantity === 1 ? "ticket" : "tickets";

    /** @type {Cents} */
    const total = { cents: price.cents * quantity };
    receiptCalc.textContent = `${quantity} × ${formatAmount(price)}`;
    totalAmt.textContent = formatAmount(total);
    continueLabel.textContent = `Get ${quantity} ${quantity === 1 ? "ticket" : "tickets"} · ${formatAmount(total)}`;
  };

  /** @param {number} dollars */
  const setPrice = (dollars) => {
    price.cents = Math.round(dollars * 100);
    priceInput.value = dollars.toFixed(2);
    render();
  };

  /** @param {number} next */
  const setQuantity = (next) => {
    quantity = Math.min(MAX_QUANTITY, Math.max(MIN_QUANTITY, Math.round(next)));
    qtyInput.value = String(quantity);
    render();
  };

  slider.addEventListener("input", () => {
    setPrice(parseFloat(slider.value) || min);
  });

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

  initSliderTicks(min, max, setPrice);

  render();
}

document.addEventListener("DOMContentLoaded", () => {
  initTicketControls();

  const form = /** @type {HTMLFormElement} */ (
    document.getElementById("afterparty-form")
  );
  initCheckoutForm(form, "donate");
});
