// @ts-check

document.addEventListener("DOMContentLoaded", () => {
  const customAmountInput = /** @type {HTMLInputElement} */ (
    document.querySelector(".custom-amount-input")
  );

  const customTierRadio = /** @type {HTMLInputElement} */ (
    document.getElementById("tier-custom")
  );

  customAmountInput.addEventListener("input", () => {
    customTierRadio.checked = true;
  });
  customAmountInput.onclick = () => {
    customTierRadio.checked = true;
  };

  // Handle cancel button confirmation
  const cancelForm = /** @type {HTMLFormElement} */ (
    document.querySelector(".cancel-subscription-form")
  );
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
      cancelButton.classList.add("btn-warning");
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
});
