// @ts-check

import { enforcePattern, validateMinAmount } from "./util/validate.mjs";

/**
 * Resize an input's width to fit its current value using a hidden measurer.
 * @param {HTMLInputElement} input
 * @param {() => number} getTextWidth
 */
function autoSize(input, getTextWidth) {
  input.style.width = `${getTextWidth()}px`;
}

/**
 * Create a hidden span that mirrors the input's font for measuring text width.
 * @param {HTMLInputElement} input
 * @returns {() => number}
 */
function createMeasurer(input) {
  const measurer = document.createElement("span");
  measurer.style.position = "absolute";
  measurer.style.visibility = "hidden";
  measurer.style.whiteSpace = "pre";

  const style = window.getComputedStyle(input);
  measurer.style.font = style.font;
  measurer.style.letterSpacing = style.letterSpacing;

  input.parentElement?.appendChild(measurer);

  return () => {
    measurer.textContent = input.value || input.placeholder || "0";
    return measurer.offsetWidth;
  };
}

document.addEventListener("DOMContentLoaded", () => {
  const amountInput = /** @type {HTMLInputElement} */ (
    document.getElementById("amount")
  );

  enforcePattern(amountInput, /^(\d+(\.\d{0,2})?)?$/);
  validateMinAmount(amountInput);

  const getTextWidth = createMeasurer(amountInput);
  autoSize(amountInput, getTextWidth);
  amountInput.addEventListener("input", () =>
    autoSize(amountInput, getTextWidth),
  );
});
