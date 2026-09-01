// @ts-check
/// <reference types="bun-types" />
import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { Window } from "happy-dom";
import {
  dollarPattern,
  enforcePattern,
  validateMinAmount,
} from "./validate.mjs";

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
 * Dispatch a happy-dom event on an element. The cast is needed because
 * happy-dom's Event type is missing deprecated browser properties
 * (isTrusted, returnValue, srcElement) that are on the built-in Event type.
 * @param {HTMLElement} el
 * @param {object} event
 */
function fire(el, event) {
  el.dispatchEvent(/** @type {Event} */ (/** @type {unknown} */ (event)));
}

describe("enforcePattern", () => {
  /** @type {HTMLInputElement} */
  let input;

  beforeEach(() => {
    input = /** @type {HTMLInputElement} */ (doc.createElement("input"));
    input.value = "";
    enforcePattern(input, dollarPattern);
  });

  it("allows valid dollar amounts", () => {
    const event = new happyWindow.InputEvent("beforeinput", {
      inputType: "insertText",
      data: "5",
      bubbles: true,
      cancelable: true,
    });
    fire(input, event);
    expect(event.defaultPrevented).toBe(false);
  });

  it("blocks letters", () => {
    const event = new happyWindow.InputEvent("beforeinput", {
      inputType: "insertText",
      data: "abc",
      bubbles: true,
      cancelable: true,
    });
    fire(input, event);
    expect(event.defaultPrevented).toBe(true);
  });

  it("blocks a third decimal place", () => {
    input.value = "1.23";
    input.selectionStart = 4;
    input.selectionEnd = 4;
    const event = new happyWindow.InputEvent("beforeinput", {
      inputType: "insertText",
      data: "4",
      bubbles: true,
      cancelable: true,
    });
    fire(input, event);
    expect(event.defaultPrevented).toBe(true);
  });

  it("allows backspace at end", () => {
    input.value = "5.00";
    input.selectionStart = 4;
    input.selectionEnd = 4;
    const event = new happyWindow.InputEvent("beforeinput", {
      inputType: "deleteContentBackward",
      bubbles: true,
      cancelable: true,
    });
    fire(input, event);
    expect(event.defaultPrevented).toBe(false);
  });

  it("allows forward-delete of a single character", () => {
    input.value = "5.00";
    input.selectionStart = 0;
    input.selectionEnd = 0;
    const event = new happyWindow.InputEvent("beforeinput", {
      inputType: "deleteContentForward",
      bubbles: true,
      cancelable: true,
    });
    fire(input, event);
    expect(event.defaultPrevented).toBe(false);
  });

  it("blocks a forward-delete that would leave three decimal places", () => {
    input.value = "1.203";
    input.selectionStart = 0;
    input.selectionEnd = 0;
    const event = new happyWindow.InputEvent("beforeinput", {
      inputType: "deleteContentForward",
      bubbles: true,
      cancelable: true,
    });
    fire(input, event);
    expect(event.defaultPrevented).toBe(true);
  });

  it("allows forward-delete of a selected range", () => {
    input.value = "12.34";
    input.selectionStart = 0;
    input.selectionEnd = 2;
    const event = new happyWindow.InputEvent("beforeinput", {
      inputType: "deleteContentForward",
      bubbles: true,
      cancelable: true,
    });
    fire(input, event);
    expect(event.defaultPrevented).toBe(false);
  });

  it("ignores input types it does not simulate", () => {
    input.value = "5.00";
    const event = new happyWindow.InputEvent("beforeinput", {
      inputType: "historyUndo",
      bubbles: true,
      cancelable: true,
    });
    fire(input, event);
    expect(event.defaultPrevented).toBe(false);
  });

  it("allows backspace before decimal", () => {
    input.value = "5.00";
    input.selectionStart = 1;
    input.selectionEnd = 1;
    const event = new happyWindow.InputEvent("beforeinput", {
      inputType: "deleteContentBackward",
      bubbles: true,
      cancelable: true,
    });
    fire(input, event);
    expect(event.defaultPrevented).toBe(false);
  });
});

describe("validateMinAmount", () => {
  /** @type {HTMLInputElement} */
  let input;

  beforeEach(() => {
    input = /** @type {HTMLInputElement} */ (doc.createElement("input"));
    input.dataset["min"] = "5";
    validateMinAmount(input);
  });

  it("clears validity when value meets min", () => {
    input.value = "10";
    fire(input, new happyWindow.Event("input"));
    expect(input.validationMessage).toBe("");
  });

  it("sets validity error when value is below min", () => {
    input.value = "2";
    fire(input, new happyWindow.Event("input"));
    expect(input.validationMessage).toInclude("below the minimum");
  });

  it("sets validity error for non-numeric input", () => {
    input.value = "abc";
    fire(input, new happyWindow.Event("input"));
    expect(input.validationMessage).toInclude("enter a number");
  });

  it("installs no listener when data-min is not a number", () => {
    const bad = /** @type {HTMLInputElement} */ (doc.createElement("input"));
    bad.dataset["min"] = "not-a-number";
    validateMinAmount(bad);

    bad.value = "1";
    fire(bad, new happyWindow.Event("input"));
    expect(bad.validationMessage).toBe("");
  });

  it("defaults the minimum to zero when data-min is absent", () => {
    const noMin = /** @type {HTMLInputElement} */ (doc.createElement("input"));
    validateMinAmount(noMin);

    noMin.value = "-1";
    fire(noMin, new happyWindow.Event("input"));
    expect(noMin.validationMessage).toInclude("below the minimum");
  });
});
