// @ts-check
/// <reference types="bun-types" />
import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { Window } from "happy-dom";
import {
  activateCustomOnInteract,
  activateCustomOnRadio,
  formatAmount,
} from "./money-forms.mjs";
import { validateMinAmount } from "./validate.mjs";

/** @typedef {import("~/types/cents").Cents} Cents */

/** @type {Window} */
let happyWindow;
/** @type {Document} */
let doc;

beforeEach(() => {
  happyWindow = new Window();
  doc = /** @type {Document} */ (/** @type {unknown} */ (happyWindow.document));
});

afterEach(async () => {
  await happyWindow.happyDOM.close();
});

/**
 * @param {object} event
 * @param {HTMLElement} el
 */
function fire(event, el) {
  el.dispatchEvent(/** @type {Event} */ (/** @type {unknown} */ (event)));
}

describe("formatAmount", () => {
  it("formats cents", () => {
    expect(formatAmount({ cents: 199 })).toBe("$1.99");
  });
});

describe("activateCustomOnInteract", () => {
  /** @type {HTMLInputElement} */
  let customInput;
  /** @type {HTMLInputElement} */
  let customRadio;
  /** @type {() => void} */
  let validate;

  beforeEach(() => {
    customInput = /** @type {HTMLInputElement} */ (doc.createElement("input"));
    customInput.type = "text";
    customInput.dataset["min"] = "5";

    customRadio = /** @type {HTMLInputElement} */ (doc.createElement("input"));
    customRadio.type = "radio";

    doc.body.appendChild(customInput);
    doc.body.appendChild(customRadio);
    validate = validateMinAmount(customInput);
  });

  it("click selects the radio and requires the input", () => {
    activateCustomOnInteract(customInput, customRadio, validate);
    customInput.click();

    expect(customRadio.checked).toBe(true);
    expect(customInput.required).toBe(true);
    expect(customInput.readOnly).toBe(false);
  });

  it("typing selects the radio and requires the input", () => {
    activateCustomOnInteract(customInput, customRadio, validate);
    fire(new happyWindow.Event("input", { bubbles: true }), customInput);

    expect(customRadio.checked).toBe(true);
    expect(customInput.required).toBe(true);
  });

  it("focus alone leaves the selection alone", () => {
    activateCustomOnInteract(customInput, customRadio, validate);
    customInput.focus();

    expect(customRadio.checked).toBe(false);
    expect(customInput.required).toBe(false);
  });

  it("starts out required only if the radio is already selected", () => {
    customRadio.checked = true;
    activateCustomOnInteract(customInput, customRadio, validate);

    expect(customInput.required).toBe(true);
  });

  it("checks an already-selected amount on start-up", () => {
    customInput.value = "1";
    customRadio.checked = true;
    activateCustomOnInteract(customInput, customRadio, validate);

    expect(customInput.validationMessage).toInclude("below the minimum");
  });

  it("re-checks a below-minimum amount when clicked back into", () => {
    activateCustomOnInteract(customInput, customRadio, validate);
    customInput.value = "1";
    // As left by picking a preset radio in the meantime.
    customInput.setCustomValidity("");

    customInput.click();

    expect(customInput.validationMessage).toInclude("below the minimum");
  });
});

describe("activateCustomOnRadio", () => {
  /** @type {HTMLInputElement} */
  let customInput;
  /** @type {HTMLInputElement} */
  let customRadio;
  /** @type {HTMLInputElement} */
  let otherRadio;

  beforeEach(() => {
    customInput = /** @type {HTMLInputElement} */ (doc.createElement("input"));
    customInput.type = "text";
    customInput.dataset["min"] = "5";

    customRadio = /** @type {HTMLInputElement} */ (doc.createElement("input"));
    customRadio.type = "radio";
    customRadio.name = "amount";
    customRadio.value = "custom";

    otherRadio = /** @type {HTMLInputElement} */ (doc.createElement("input"));
    otherRadio.type = "radio";
    otherRadio.name = "amount";
    otherRadio.value = "500";

    doc.body.appendChild(customInput);
    doc.body.appendChild(customRadio);
    doc.body.appendChild(otherRadio);

    const radios = /** @type {NodeListOf<HTMLInputElement>} */ (
      doc.querySelectorAll("input[type=radio]")
    );
    activateCustomOnRadio(radios, customInput, validateMinAmount(customInput));
  });

  it("requires the input when the custom radio is selected", () => {
    customRadio.checked = true;
    fire(new happyWindow.Event("change", { bubbles: true }), customRadio);

    expect(customInput.required).toBe(true);
  });

  it("re-checks a below-minimum amount when the custom radio is selected", () => {
    customInput.value = "1";
    customRadio.checked = true;
    fire(new happyWindow.Event("change", { bubbles: true }), customRadio);

    expect(customInput.validationMessage).toInclude("below the minimum");
  });

  it("stops requiring the input when a non-custom radio is selected", () => {
    customInput.required = true;
    otherRadio.checked = true;
    fire(new happyWindow.Event("change", { bubbles: true }), otherRadio);

    expect(customInput.required).toBe(false);
  });

  it("clears custom validity when a non-custom radio is selected", () => {
    customInput.setCustomValidity("Too low");
    otherRadio.checked = true;
    fire(new happyWindow.Event("change", { bubbles: true }), otherRadio);

    expect(customInput.validationMessage).toBe("");
  });
});
