// @ts-check

/** @typedef {import("~/types/cents").Cents} Cents */

/**
 * Format a dollar value for display.
 * @param {string} value
 * @returns {string}
 */
export function formatDollarLabel(value) {
  const dollars = parseFloat(value);
  return Number.isNaN(dollars) ? "$0.00" : `$${dollars.toFixed(2)}`;
}

/**
 * Format cents as a dollar amount.
 * @param {Cents} amount
 * @returns {string}
 */
export function formatAmount(amount) {
  return `$${(amount.cents / 100).toFixed(2)}`;
}

/**
 * Split cents into its dollar and cent parts for aligned display.
 * @param {Cents} amount
 * @returns {{ dollars: string, cents: string }}
 */
export function splitAmount(amount) {
  const parts = (amount.cents / 100).toFixed(2).split(".");
  return {
    dollars: /** @type {string} */ (parts[0]),
    cents: /** @type {string} */ (parts[1]),
  };
}

/**
 * Sets up event listeners to activate the "Custom" amount radio button when the
 * associated free-form input field is interacted with.
 *
 * @param {HTMLInputElement} customInputField
 * @param {HTMLInputElement} customRadioButton
 */
export function activateCustomOnClick(customInputField, customRadioButton) {
  // Touch devices
  customInputField.addEventListener("touchend", (e) => {
    // [HACK]: Using the read-only flag as a substitute for disabled
    if (!customInputField.readOnly) {
      return;
    }

    e.preventDefault();
    customRadioButton.checked = true;
    customInputField.readOnly = false;
    customInputField.focus();
  });

  // Non-touch devices
  customInputField.addEventListener("click", () => {
    if (!customInputField.readOnly) {
      return;
    }

    customRadioButton.checked = true;
    customInputField.readOnly = false;
  });
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
