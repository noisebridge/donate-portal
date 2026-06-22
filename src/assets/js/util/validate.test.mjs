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
});
