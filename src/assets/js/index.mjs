// @ts-check

import { initMessages } from "./util/messages.mjs";
import {
  activateCustomOnClick,
  activateCustomOnRadio,
} from "./util/money-forms.mjs";
import { enforcePattern, validateMinAmount } from "./util/validate.mjs";

function initCustomAmount() {
  const customAmountInput = /** @type {HTMLInputElement} */ (
    document.getElementById("custom-amount")
  );
  const amountRadios = /** @type {NodeListOf<HTMLInputElement>} */ (
    document.querySelectorAll('input[name="amount-dollars"]')
  );
  const customAmountRadio = /** @type {HTMLInputElement} */ (
    document.getElementById("amount-custom")
  );

  enforcePattern(customAmountInput, /^(\d+(\.\d{0,2})?)?$/);

  validateMinAmount(customAmountInput);

  activateCustomOnClick(customAmountInput, customAmountRadio);

  activateCustomOnRadio(amountRadios, customAmountInput);
}

document.addEventListener("DOMContentLoaded", () => {
  initMessages();
  initCustomAmount();
});
