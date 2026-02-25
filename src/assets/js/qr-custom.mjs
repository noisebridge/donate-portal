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

/**
 * Update hint text along with dollar amount changes.
 * @param {HTMLInputElement} amountInput
 * @param {HTMLSpanElement} hint
 */
function hintHandler(amountInput, hint) {
  const originalHint = hint.textContent;

  amountInput.addEventListener("input", () => {
    const dollars = parseFloat(amountInput.value);
    if (amountInput.value.endsWith(".69")) {
      hint.textContent = "Nice.";
    } else if (dollars >= 4 && dollars < 4.2) {
      hint.textContent = "Why not $4.20 (blaze it)?";
    } else if (dollars === 4.2) {
      hint.textContent = "Hell yeah 🤘";
    } else if (dollars >= 10 && dollars < 13.37) {
      hint.textContent = "Why not $13.37?";
    } else if (dollars === 13.37) {
      hint.textContent = "Hack the planet!";
    } else if (dollars >= 60 && dollars < 69) {
      hint.textContent = "Why not $69?";
    } else if (dollars === 69) {
      hint.textContent = "Nice.";
    } else if (dollars >= 100 && dollars < 133.7) {
      hint.textContent = "Why not $133.70?";
    } else if (dollars === 133.7) {
      hint.textContent = "Hack the planet!";
    } else if (dollars >= 400 && dollars < 420) {
      hint.textContent = "Why not $420 (blaze it)?";
    } else if (dollars === 420) {
      hint.textContent = "Hell yeah 🤘";
    } else if (dollars >= 1000 && dollars < 1337) {
      hint.textContent = "Why not $1,337?";
    } else if (dollars === 1337) {
      hint.textContent = "Hack the planet!";
    } else {
      hint.textContent = originalHint;
    }
  });
}

/**
 * Auto-resize a textarea to fit its content.
 * @param {HTMLTextAreaElement} textarea
 */
function autoResizeTextarea(textarea) {
  textarea.style.height = "auto";
  textarea.style.height = `${textarea.scrollHeight}px`;
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

  const hint = /** @type {HTMLElement} */ (
    document.querySelector(".form-hint")
  );
  hintHandler(amountInput, hint);

  document.querySelectorAll("textarea").forEach((textarea) => {
    autoResizeTextarea(textarea);
    textarea.addEventListener("input", () => autoResizeTextarea(textarea));
    window.addEventListener("resize", () => autoResizeTextarea(textarea));
    window.addEventListener("load", () => autoResizeTextarea(textarea));
  });
});
