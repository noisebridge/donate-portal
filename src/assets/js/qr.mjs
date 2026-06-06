// @ts-check

import { formatAmount } from "./util/money-forms.mjs";
import { initCheckoutForm } from "./util/stripe.mjs";
import {
  dollarPattern,
  enforcePattern,
  validateMinAmount,
} from "./util/validate.mjs";

/** @typedef {import("~/types/cents").Cents} Cents */

/**
 * Wire up the amount slider, the editable amount input and the preset ticks so
 * they all stay in sync and keep the donate button label current.
 */
function initAmountControls() {
  const slider = /** @type {HTMLInputElement | null} */ (
    document.getElementById("amount-slider")
  );
  const amountInput = /** @type {HTMLInputElement | null} */ (
    document.getElementById("amount-input")
  );
  const buttonText = document.getElementById("donate-label");
  if (!slider || !amountInput || !buttonText) {
    return;
  }

  enforcePattern(amountInput, dollarPattern);
  validateMinAmount(amountInput);

  /** @type {Cents} */
  const currentAmount = { cents: parseFloat(amountInput.value) * 100 };
  const min = parseFloat(slider.min) || 0;
  const max = parseFloat(slider.max) || 0;

  const update = () => {
    const dollars = currentAmount.cents / 100;
    // Update input field
    amountInput.value = dollars.toFixed(2);
    // Update button text
    buttonText.textContent = `Donate · ${formatAmount(currentAmount)}`;
    // Update slider
    slider.value = String(Math.min(max, Math.max(min, dollars)));
  };
  slider.addEventListener("input", () => {
    currentAmount.cents = Math.floor(parseFloat(slider.value) * 100);
    update();
  });
  amountInput.addEventListener("input", () => {
    currentAmount.cents = Math.floor(parseFloat(amountInput.value) * 100);
  });
  amountInput.addEventListener("blur", update);

  const ticks = /** @type {NodeListOf<HTMLElement>} */ (
    document.querySelectorAll("#slider-ticks .tick")
  );
  ticks.forEach((tick) => {
    const amount = tick.dataset["amt"];
    if (amount === undefined) {
      return;
    }

    const value = parseFloat(amount);
    if (Number.isNaN(value)) {
      return;
    }

    // Position each tick at the fraction of the track matching its amount, so the
    // pips line up with where the slider thumb actually sits. CSP blocks inline
    // style attributes, so this is set here rather than in the rendered markup.
    const frac = max > min ? (value - min) / (max - min) : 0;
    tick.style.setProperty("--frac", String(frac));

    // Clicking a tick jumps to that preset amount.
    tick.addEventListener("click", () => {
      currentAmount.cents = value * 100;
      update();
    });
  });

  update();
}

/**
 * Wire up the "Custom" toggle so it unlocks editing of the name and
 * description fields.
 */
function initCustomToggle() {
  const customToggle = /** @type {HTMLInputElement | null} */ (
    document.getElementById("custom-toggle")
  );
  const nameInput = /** @type {HTMLInputElement | null} */ (
    document.getElementById("name")
  );
  const descInput = /** @type {HTMLTextAreaElement | null} */ (
    document.getElementById("description")
  );
  if (!customToggle || !nameInput || !descInput) {
    return;
  }

  // Clicking a field's wrapping <label> focuses the control even when it's
  // read-only and pointer-events are off, so refuse focus outside custom mode.
  nameInput.addEventListener(
    "focus",
    () => !customToggle.checked && nameInput.blur(),
  );
  descInput.addEventListener(
    "focus",
    () => !customToggle.checked && descInput.blur(),
  );

  // Remember the original values so they can be restored if the user cancels
  // out of custom mode.
  const originalName = nameInput.value;
  const originalDescription = descInput.value;

  customToggle.addEventListener("change", () => {
    const on = customToggle.checked;
    nameInput.readOnly = !on;
    descInput.readOnly = !on;

    if (!on) {
      nameInput.value = originalName;
      descInput.value = originalDescription;
      return;
    }

    setTimeout(() => nameInput.focus(), 50);
  });
}

document.addEventListener("DOMContentLoaded", () => {
  initAmountControls();
  initCustomToggle();

  const form = /** @type {HTMLFormElement} */ (
    document.getElementById("donate-form")
  );
  initCheckoutForm(form, "donate");
});
