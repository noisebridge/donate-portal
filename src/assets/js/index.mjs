// @ts-check

/**
 * Enable/disable custom amount input and donate button based on selection
 */
document.addEventListener('DOMContentLoaded', () => {
  const customAmountInput = /** @type {HTMLInputElement} */ (
    document.getElementById("custom-amount")
  );
  const amountRadios = /** @type {NodeListOf<HTMLInputElement>} */ (
    document.querySelectorAll('input[name="amount"]')
  );
  const donateButton = /** @type {HTMLButtonElement} */ (
    document.querySelector('.onetime-donation button[type="submit"]')
  );
  donateButton.disabled = true;

  /**
   * Update donate button state
   */
  function updateDonateButton() {
    const customRadio = /** @type {HTMLInputElement} */ (
      document.getElementById("amount-custom")
    );

    if (customRadio.checked) {
      const customValue = parseFloat(customAmountInput.value);
      donateButton.disabled = !customValue || customValue <= 0;
    } else {
      const anySelected = Array.from(amountRadios).some(radio => radio.checked);
      donateButton.disabled = !anySelected;
    }
  }

  amountRadios.forEach((radio) => {
    radio.addEventListener("change", () => {
      if (radio.value === "custom" && radio.checked) {
        customAmountInput.disabled = false;
        customAmountInput.focus();
      } else {
        customAmountInput.disabled = true;
      }
      updateDonateButton();
    });
  });

  customAmountInput.addEventListener("input", updateDonateButton);
});
