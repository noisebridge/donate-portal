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

/**
 * Update the hint text to a playful suggestion based on the current dollar
 * amount, falling back to the original hint when nothing matches.
 * @param {HTMLElement} hint
 * @param {string} originalHint
 * @param {number} dollars
 */
function updateHint(hint, originalHint, dollars) {
  if (Math.round(dollars * 100) % 100 === 69) {
    hint.textContent = "Nice.";
  } else if (dollars >= 4 && dollars < 4.2) {
    hint.textContent = "Why not $4.20 (blaze it)?";
  } else if (dollars === 4.2) {
    hint.textContent = "Hell yeah 🤘";
  } else if (dollars >= 10 && dollars < 13.37) {
    hint.textContent = "Why not $13.37?";
  } else if (dollars === 13.37) {
    hint.textContent = "Hack the planet!";
  } else if (dollars >= 16 && dollars < 17.76) {
    hint.textContent = "Why not $17.76?";
  } else if (dollars === 17.76) {
    hint.textContent = "'Merica, baby!";
  } else if (dollars >= 40 && dollars < 42) {
    hint.textContent = "Why not $42.00?";
  } else if (dollars === 42) {
    hint.textContent = "Thanks for all the fish! 🐬";
  } else if (dollars >= 60 && dollars < 69) {
    hint.textContent = "Why not $69?";
  } else if (dollars === 69) {
    hint.textContent = "Nice.";
  } else if (dollars >= 100 && dollars < 133.7) {
    hint.textContent = "Why not $133.70?";
  } else if (dollars === 133.7) {
    hint.textContent = "Hack the planet!";
  } else if (dollars >= 400 && dollars < 420) {
    hint.textContent = "Why not $420 (blaze it)?";
  } else if (dollars === 420) {
    hint.textContent = "Hell yeah 🤘";
  } else if (dollars >= 1000 && dollars < 1337) {
    hint.textContent = "Why not $1,337?";
  } else if (dollars === 1337) {
    hint.textContent = "Hack the planet!";
  } else {
    hint.textContent = originalHint;
  }
}

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
  const hint = document.getElementById("amount-hint");
  if (!slider || !amountInput || !buttonText || !hint) {
    return;
  }

  enforcePattern(amountInput, dollarPattern);
  validateMinAmount(amountInput);

  const originalHint = hint?.textContent ?? "";

  /** @type {Cents} */
  const currentAmount = {
    cents: Math.round(parseFloat(amountInput.value) * 100),
  };
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
    // Update hint
    updateHint(hint, originalHint, dollars);
  };
  slider.addEventListener("input", () => {
    currentAmount.cents = Math.round(parseFloat(slider.value) * 100);
    update();
  });
  amountInput.addEventListener("input", () => {
    const dollars = parseFloat(amountInput.value);
    if (Number.isNaN(dollars)) {
      // Keep the last valid amount so blur restores it instead of "NaN".
      return;
    }
    currentAmount.cents = Math.round(dollars * 100);
    updateHint(hint, originalHint, dollars);
  });
  amountInput.addEventListener("blur", update);

  initSliderTicks(min, max, (value) => {
    currentAmount.cents = Math.round(value * 100);
    update();
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
    const custom = customToggle.checked;
    nameInput.readOnly = !custom;
    descInput.readOnly = !custom;

    if (!custom) {
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
