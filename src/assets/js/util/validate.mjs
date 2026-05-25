// @ts-check

/**
 * Allows for values of the form "123.45", or any other partially typed form.
 * This allows a user to take an input with the value "5.00", delete the leading
 * 5 and replace it with a 6.
 */
export const dollarPattern = /^(\d*(\.\d{0,2})?)?$/;

/**
 * Prevent an input field from diverging from a `RegExp`.
 * @param {HTMLInputElement} input
 * @param {RegExp} pattern
 */
export function enforcePattern(input, pattern) {
  input.addEventListener("beforeinput", (event) => {
    const value = input.value;
    const start = input.selectionStart ?? value.length;
    const end = input.selectionEnd ?? start;

    /** @type {string} */
    let simulated;
    switch (event.inputType) {
      case "insertText":
      case "insertFromPaste":
      case "insertFromDrop":
        simulated =
          value.slice(0, start) + (event.data ?? "") + value.slice(end);
        break;
      case "deleteContentBackward":
        simulated =
          start === end
            ? value.slice(0, Math.max(0, start - 1)) + value.slice(end)
            : value.slice(0, start) + value.slice(end);
        break;
      case "deleteContentForward":
        simulated =
          start === end
            ? value.slice(0, start) + value.slice(end + 1)
            : value.slice(0, start) + value.slice(end);
        break;
      default:
        return;
    }

    if (!pattern.test(simulated)) {
      event.preventDefault();
    }
  });
}

/**
 * Install a validator on an input that requires the value to be above a min.
 * Reads the `data-min` attribute on `input`.
 *
 * @param {HTMLInputElement} input
 */
export function validateMinAmount(input) {
  const min = parseFloat(input.dataset["min"] ?? "0");
  if (Number.isNaN(min)) {
    console.error(
      input.dataset["min"],
      " as data-min attribute is invalid for ",
      input,
    );
    return;
  }

  input.addEventListener("input", () => {
    const value = parseFloat(input.value);
    if (Number.isNaN(value)) {
      input.setCustomValidity("Please enter a number");
      return;
    }
    if (value < min) {
      input.setCustomValidity("This value is below the minimum");
      return;
    }

    input.setCustomValidity("");
  });
}
