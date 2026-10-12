// @ts-check

import {
  dollarPattern,
  enforcePattern,
  validateMinAmount,
} from "./validate.mjs";

/** @typedef {import("~/types/cents").Cents} Cents */

/**
 * Format cents as a dollar amount.
 * @param {Cents} amount
 * @returns {string}
 */
export function formatAmount(amount) {
  return `$${(amount.cents / 100).toFixed(2)}`;
}

/**
 * Wire up a "Custom" amount input: restrict it to dollar amounts, enforce its
 * `data-min`, and keep it in sync with the radio group it belongs to.
 *
 * @param {HTMLInputElement} customInputField
 * @param {HTMLInputElement} customRadioButton
 * @param {NodeListOf<HTMLInputElement>} radioButtons
 */
export function initCustomAmount(
  customInputField,
  customRadioButton,
  radioButtons,
) {
  enforcePattern(customInputField, dollarPattern);
  validateMinAmount(customInputField);
  activateCustomOnInteract(customInputField, customRadioButton);
  activateCustomOnRadio(radioButtons, customInputField);
}

/**
 * Selects the "Custom" amount radio button when the associated free-form input
 * field is clicked or typed into. The field is never read-only: iOS won't raise
 * the keyboard on the first tap of a read-only field, even if JS unlocks it
 * mid-tap. Focus alone doesn't activate it, so tabbing past the field doesn't
 * change the selected amount.
 *
 * @param {HTMLInputElement} customInputField
 * @param {HTMLInputElement} customRadioButton
 */
export function activateCustomOnInteract(customInputField, customRadioButton) {
  customInputField.required = customRadioButton.checked;

  function activate() {
    customRadioButton.checked = true;
    customInputField.required = true;
  }

  customInputField.addEventListener("click", activate);
  customInputField.addEventListener("input", activate);
}

/**
 * Sets up event listeners to require the free-form input field only while the
 * "Custom" radio button is active.
 *
 * @param {NodeListOf<HTMLInputElement>} radioButtons
 * @param {HTMLInputElement} customInputField
 */
export function activateCustomOnRadio(radioButtons, customInputField) {
  /** @type {(event: Event) => void} */
  const eventHandler = (event) => {
    const radio = /** @type {HTMLInputElement} */ (event.target);

    if (radio.value === "custom" && radio.checked) {
      customInputField.required = true;
      customInputField.focus();
    } else {
      customInputField.required = false;
      customInputField.setCustomValidity("");
    }
  };

  radioButtons.forEach((radio) => {
    radio.addEventListener("change", eventHandler);
  });
}
