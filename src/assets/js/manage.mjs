// @ts-check

import { initMessages } from "./messages.mjs";

function customAmountHandler() {
  const customTierRadio = /** @type {HTMLInputElement} */ (
    document.getElementById("tier-custom")
  );

  const customAmountInput = /** @type {HTMLInputElement} */ (
    document.getElementById("custom-amount")
  );

  customAmountInput.addEventListener("input", () => {
    customTierRadio.checked = true;
  });
  customAmountInput.addEventListener("click", () => {
    customTierRadio.checked = true;
  });
}

function cancelFormHandler() {
  // Handle cancel button confirmation
  const cancelForm = /** @type {HTMLFormElement | null} */ (
    document.querySelector(".cancel-subscription-form")
  );
  if (!cancelForm) {
    // There is no cancel form if there is no current subscription.
    return;
  }

  const cancelButton = /** @type {HTMLButtonElement} */ (
    cancelForm.querySelector('button[type="submit"]')
  );

  let confirmClicked = false;
  const originalText = cancelButton.textContent || "Cancel Monthly Donation";

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
        cancelButton.classList.remove("btn-warning");
      }
    },
    true,
  );
}

document.addEventListener("DOMContentLoaded", () => {
  initMessages();
  customAmountHandler();
  cancelFormHandler();
});
