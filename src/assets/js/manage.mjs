// @ts-check

import { initMessages } from "./util/messages.mjs";
import { initCustomAmount } from "./util/money-forms.mjs";
import { initCheckoutForm } from "./util/stripe.mjs";

function initCancelForm() {
  const cancelForm = /** @type {HTMLFormElement | null} */ (
    document.querySelector(".cancel-subscription-form")
  );
  if (!cancelForm) {
    return;
  }

  const cancelButton = /** @type {HTMLButtonElement} */ (
    cancelForm.querySelector('button[type="submit"]')
  );

  // Only the label span, so the icon/arrow/suffix markup survives.
  const label = /** @type {HTMLSpanElement} */ (
    cancelButton.querySelector(".btn-label")
  );

  let confirmClicked = false;
  const originalText = label.textContent;

  cancelButton.addEventListener("click", (event) => {
    if (!confirmClicked) {
      event.preventDefault();
      confirmClicked = true;
      label.textContent = "Press again to confirm";
    }
  });

  const reset = () => {
    if (confirmClicked) {
      confirmClicked = false;
      label.textContent = originalText;
    }
  };

  // Reset if the user tabs away or clicks elsewhere. The pointerdown listener
  // is needed because Safari doesn't focus buttons on click, so clicking away
  // never fires a blur there.
  cancelForm.addEventListener("blur", reset, true);
  document.addEventListener("pointerdown", (event) => {
    if (!(event.target instanceof Node) || !cancelForm.contains(event.target)) {
      reset();
    }
  });
}

document.addEventListener("DOMContentLoaded", () => {
  initMessages();
  initCustomAmount(
    /** @type {HTMLInputElement} */ (document.getElementById("custom-amount")),
    /** @type {HTMLInputElement} */ (document.getElementById("tier-custom")),
    /** @type {NodeListOf<HTMLInputElement>} */ (
      document.querySelectorAll(".tier-options input[type=radio]")
    ),
  );
  initCancelForm();

  const form = /** @type {HTMLFormElement} */ (
    document.querySelector(".donation-tier-form")
  );
  initCheckoutForm(form, "subscribe");
});
