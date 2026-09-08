// @ts-check

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
 * Sets up event listeners to activate the "Custom" amount radio button when the
 * associated free-form input field is interacted with.
 *
 * @param {HTMLInputElement} customInputField
 * @param {HTMLInputElement} customRadioButton
 */
export function activateCustomOnClick(customInputField, customRadioButton) {
  function activate() {
    // [HACK]: Using the read-only flag as a substitute for disabled
    if (!customInputField.readOnly) return false;
    customRadioButton.checked = true;
    customInputField.readOnly = false;
    return true;
  }

  // Touch devices
  customInputField.addEventListener("touchend", (e) => {
    if (activate()) {
      e.preventDefault();
      customInputField.focus();
    }
  });

  // Non-touch devices
  customInputField.addEventListener("click", activate);
}

/**
 * Sets up event listeners to enable/disable the free-form input field depending
 * on which radio button is active.
 *
 * @param {NodeListOf<HTMLInputElement>} radioButtons
 * @param {HTMLInputElement} customInputField
 */
export function activateCustomOnRadio(radioButtons, customInputField) {
  /** @type {(event: Event) => void} */
  const eventHandler = (event) => {
    const radio = /** @type {HTMLInputElement} */ (event.target);

    if (radio.value === "custom" && radio.checked) {
      customInputField.readOnly = false;
      customInputField.focus();
    } else {
      customInputField.readOnly = true;
      customInputField.setCustomValidity("");
    }
  };

  radioButtons.forEach((radio) => {
    radio.addEventListener("change", eventHandler);
  });
}
