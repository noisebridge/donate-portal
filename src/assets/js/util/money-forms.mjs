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
    radio.addEventListener("input", eventHandler);
  });
}
