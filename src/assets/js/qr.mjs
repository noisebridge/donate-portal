// @ts-check

/**
 * Initialize the QR donation page slider.
 */
function initSlider() {
  const slider = /** @type {HTMLInputElement | null} */ (
    document.getElementById("amount-slider")
  );
  if (!slider) {
    return;
  }

  const amountDisplay = document.getElementById("current-amount");
  if (!amountDisplay) {
    return;
  }

  const hiddenInput = /** @type {HTMLInputElement | null} */ (
    document.getElementById("hidden-amount")
  );
  if (!hiddenInput) {
    return;
  }

  slider.addEventListener("input", () => {
    const dollars = parseFloat(slider.value).toFixed(2);
    amountDisplay.textContent = `$${dollars}`;
    hiddenInput.value = slider.value;
  });
}

document.addEventListener("DOMContentLoaded", () => {
  initSlider();
});
