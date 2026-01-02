// @ts-check

/**
 * Prevent an input field from diverging from a `RegExp`.
 * @param {HTMLInputElement} input
 * @param {RegExp} pattern
 */
export function enforcePattern(input, pattern) {
  input.addEventListener("beforeinput", (event) => {
    const currentValue = input.value;

    const prefix = currentValue.substring(0, input.selectionStart ?? 0);
    const newInput = event.data ?? "";
    const suffix = currentValue.substring(input.selectionEnd ?? 0);
    const newValue = `${prefix}${newInput}${suffix}`;

    if (!pattern.test(newValue)) {
      event.preventDefault();
    }
  });
}

/**
 * Install a validator on an input that requires the value to be above a min.
 *
 * Reads the `data-min` attribute on `input`.
 *
 * @param {HTMLInputElement} input
 */
export function validateMinAmount(input) {
  input.addEventListener("input", () => {
    const min = parseFloat(input.dataset["min"] ?? "0");
    const value = parseFloat(input.value);

    if (Number.isNaN(value)) {
      input.setCustomValidity(`Please enter a number`);
      return;
    }

    if (value < min) {
      input.setCustomValidity(`Minimum donation is $${min.toFixed(2)}`);
      return;
    }

    input.setCustomValidity("");
    return;
  });
}
