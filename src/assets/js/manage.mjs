// @ts-check

import { initMessages } from "./util/messages.mjs";
import {
  activateCustomOnClick,
  activateCustomOnRadio,
} from "./util/money-forms.mjs";
import { enforcePattern, validateMinAmount } from "./util/validate.mjs";

function initCustomAmount() {
  const customTierRadio = /** @type {HTMLInputElement} */ (
    document.getElementById("tier-custom")
  );
  const customAmountInput = /** @type {HTMLInputElement} */ (
    document.getElementById("custom-amount")
  );
  const radioButtons = /** @type {NodeListOf<HTMLInputElement>} */ (
    document.querySelectorAll(".tier-options input[type=radio]")
  );

  enforcePattern(customAmountInput, /^(\d+(\.\d{0,2})?)?$/);

  validateMinAmount(customAmountInput);

  activateCustomOnClick(customAmountInput, customTierRadio);

  activateCustomOnRadio(radioButtons, customAmountInput);
}

function initCancelForm() {
  const cancelForm = /** @type {HTMLFormElement} */ (
    document.querySelector(".cancel-subscription-form")
  );
  const cancelButton = /** @type {HTMLButtonElement} */ (
    cancelForm.querySelector('button[type="submit"]')
  );

  let confirmClicked = false;
  const originalText = cancelButton.textContent;

  cancelButton.addEventListener("click", (event) => {
    if (!confirmClicked) {
      event.preventDefault();
      confirmClicked = true;
      cancelButton.textContent = "Press again to confirm";
    }
  });

  // Reset if user clicks away
  cancelForm.addEventListener(
    "blur",
    () => {
      if (confirmClicked) {
        confirmClicked = false;
        cancelButton.textContent = originalText;
      }
    },
    true,
  );
}

document.addEventListener("DOMContentLoaded", () => {
  initMessages();
  initCustomAmount();
  initCancelForm();
});
