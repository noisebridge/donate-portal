// @ts-check

import { initMessages } from "./messages.mjs";

function handleCustomInput() {
  const customAmountInput = /** @type {HTMLInputElement} */ (
    document.getElementById("custom-amount")
  );
  const amountRadios = /** @type {NodeListOf<HTMLInputElement>} */ (
    document.querySelectorAll('input[name="amount-dollars"]')
  );

  amountRadios.forEach((radio) => {
    /** @type {(event: Event) => void} */
    const eventHandler = (event) => {
      const radio = /** @type {HTMLInputElement} */ (event.target);

      if (radio.value === "custom" && radio.checked) {
        customAmountInput.disabled = false;
        customAmountInput.focus();
      } else {
        customAmountInput.disabled = true;
      }
    };

    radio.addEventListener("input", eventHandler);
  });
}

document.addEventListener("DOMContentLoaded", () => {
  initMessages();
  handleCustomInput();
});
