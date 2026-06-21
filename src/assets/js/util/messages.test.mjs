// @ts-check
import { afterEach, beforeEach, describe, expect, it, jest } from "bun:test";
import { Window } from "happy-dom";
import { initMessages } from "./messages.mjs";

/**
 * @typedef {import("~/types/message").Message} Message
 */

/** @type {Window} */
let happyWindow;
/** @type {Document} */
let doc;

beforeEach(() => {
  happyWindow = new Window({ url: "https://example.com/?info=msg&error=err" });
  doc = /** @type {Document} */ (/** @type {unknown} */ (happyWindow.document));
  /** @type {any} */ (globalThis).document = doc;
  /** @type {any} */ (globalThis).window = happyWindow;
  /** @type {any} */ (globalThis).history = happyWindow.history;
  jest.useFakeTimers();
});

afterEach(async () => {
  jest.useRealTimers();
  delete (/** @type {any} */ (globalThis).document);
  delete (/** @type {any} */ (globalThis).window);
  delete (/** @type {any} */ (globalThis).history);
  await happyWindow.happyDOM.close();
});

/**
 * @param {Message[]} messages
 * @returns {HTMLDivElement}
 */
function buildDOM(messages) {
  const container = doc.createElement("div");
  container.className = "message-container";

  for (const { type, text } of messages) {
    const message = doc.createElement("div");
    message.className = "message";
    message.dataset["type"] = type;

    const messageText = doc.createElement("span");
    messageText.className = "message-text";
    messageText.innerText = text;

    const btn = doc.createElement("button");
    btn.className = "message-dismiss";

    message.appendChild(messageText);
    message.appendChild(btn);
    container.appendChild(message);
  }

  doc.body.appendChild(container);

  return container;
}

describe("initMessages", () => {
  it("does nothing when there is no message container", () => {
    initMessages();
    expect(doc.querySelector(".message-container")).toBeNull();
  });

  it("removes a message when its dismiss button is clicked", () => {
    const container = buildDOM([{ type: "error", text: "Error!" }]);
    initMessages();

    expect(container.querySelector(".message")).not.toBeNull();

    /** @type {HTMLElement} */ (
      container.querySelector(".message-dismiss")
    ).click();

    expect(container.querySelector(".message")).toBeNull();
  });

  it("removes the container when the last message is dismissed", () => {
    buildDOM([{ type: "error", text: "Error!" }]);
    initMessages();

    const dismissButton = /** @type {HTMLElement | null} */ (
      doc.querySelector(".message-dismiss")
    );
    if (dismissButton === null) {
      expect(dismissButton).not.toBeNull();
      return;
    }

    dismissButton.click();

    expect(doc.querySelector(".message-container")).toBeNull();
  });

  it("keeps the container when other messages remain", () => {
    const container = buildDOM([
      { type: "error", text: "Error!" },
      { type: "info", text: "Info :D" },
    ]);
    initMessages();

    const dismissButton = /** @type {HTMLElement | null} */ (
      doc.querySelector(".message-dismiss")
    );
    if (dismissButton === null) {
      expect(dismissButton).not.toBeNull();
      return;
    }

    dismissButton.click();

    expect(doc.querySelector(".message-container")).not.toBeNull();
    expect(container.querySelectorAll(".message")).toHaveLength(1);
  });

  it("auto-dismisses info messages after 8 seconds", () => {
    buildDOM([{ type: "info", text: "Info :D" }]);
    initMessages();

    jest.advanceTimersByTime(8000);

    expect(doc.querySelector(".message")).toBeNull();
  });

  it("does not auto-dismiss error messages", () => {
    buildDOM([{ type: "error", text: "Error!" }]);
    initMessages();

    jest.advanceTimersByTime(10000);

    expect(doc.querySelector(".message")).not.toBeNull();
  });

  it("removes the message type's query param when dismissed", () => {
    buildDOM([{ type: "error", text: "Error!" }]);
    initMessages();

    const dismissButton = /** @type {HTMLElement | null} */ (
      doc.querySelector(".message-dismiss")
    );
    if (dismissButton === null) {
      expect(dismissButton).not.toBeNull();
      return;
    }

    dismissButton.click();

    expect(happyWindow.location.search).not.toContain("error");
    expect(happyWindow.location.search).toContain("info");
  });

  it("does not dismiss a message that was already removed from the DOM", () => {
    buildDOM([{ type: "info", text: "Info :D" }]);
    initMessages();

    const dismissButton = /** @type {HTMLElement | null} */ (
      doc.querySelector(".message-dismiss")
    );
    if (dismissButton === null) {
      expect(dismissButton).not.toBeNull();
      return;
    }

    dismissButton.click();

    expect(() => dismissButton.click()).not.toThrow();
  });
});
