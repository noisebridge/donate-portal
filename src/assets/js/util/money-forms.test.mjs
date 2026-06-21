// @ts-check
import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { Window } from "happy-dom";
import {
  activateCustomOnClick,
  activateCustomOnRadio,
  formatAmount,
} from "./money-forms.mjs";

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

describe("activateCustomOnClick", () => {
  /** @type {HTMLInputElement} */
  let customInput;
  /** @type {HTMLInputElement} */
  let customRadio;

  beforeEach(() => {
    customInput = /** @type {HTMLInputElement} */ (doc.createElement("input"));
    customInput.type = "text";
    customInput.readOnly = true;

    customRadio = /** @type {HTMLInputElement} */ (doc.createElement("input"));
    customRadio.type = "radio";
    customRadio.value = "custom";
    customRadio.checked = false;

    doc.body.appendChild(customInput);
    doc.body.appendChild(customRadio);

    activateCustomOnClick(customInput, customRadio);
  });

  it("click activates the radio and enables the input", () => {
    customInput.click();

    expect(customRadio.checked).toBe(true);
    expect(customInput.readOnly).toBe(false);
  });

  it("touchend activates the radio and enables the input", () => {
    const event = new happyWindow.TouchEvent("touchend", {
      bubbles: true,
      cancelable: true,
    });
    fire(event, customInput);

    expect(customRadio.checked).toBe(true);
    expect(customInput.readOnly).toBe(false);
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
    customInput.readOnly = true;

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
    activateCustomOnRadio(radios, customInput);
  });

  it("enables the input when the custom radio is selected", () => {
    customRadio.checked = true;
    fire(new happyWindow.Event("change", { bubbles: true }), customRadio);

    expect(customInput.readOnly).toBe(false);
  });

  it("disables the input when a non-custom radio is selected", () => {
    customInput.readOnly = false;
    otherRadio.checked = true;
    fire(new happyWindow.Event("change", { bubbles: true }), otherRadio);

    expect(customInput.readOnly).toBe(true);
  });

  it("clears custom validity when a non-custom radio is selected", () => {
    customInput.setCustomValidity("Too low");
    otherRadio.checked = true;
    fire(new happyWindow.Event("change", { bubbles: true }), otherRadio);

    expect(customInput.validationMessage).toBe("");
  });
});
