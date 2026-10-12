// @ts-check

import { initMessages } from "./util/messages.mjs";
import { initCustomAmount } from "./util/money-forms.mjs";
import { initCheckoutForm } from "./util/stripe.mjs";

document.addEventListener("DOMContentLoaded", () => {
  initMessages();
  initCustomAmount(
    /** @type {HTMLInputElement} */ (document.getElementById("custom-amount")),
    /** @type {HTMLInputElement} */ (document.getElementById("amount-custom")),
    /** @type {NodeListOf<HTMLInputElement>} */ (
      document.querySelectorAll('input[name="amount-dollars"]')
    ),
  );

  const form = /** @type {HTMLFormElement} */ (
    document.getElementById("donate-form")
  );
  initCheckoutForm(form, "donate");
});
