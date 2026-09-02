// @ts-check
/// <reference types="bun-types" />
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
} from "bun:test";
import { Window } from "happy-dom";

/** @type {Window} */
let happyWindow;
/** @type {Document} */
let doc;

beforeAll(async () => {
  happyWindow = new Window({ url: "https://donate.example.com/manage" });
  doc = /** @type {Document} */ (/** @type {unknown} */ (happyWindow.document));
  /** @type {any} */ (globalThis).window = happyWindow;
  /** @type {any} */ (globalThis).document = doc;
  // The cancel-form reset narrows an event target with `instanceof Node`.
  /** @type {any} */ (globalThis).Node = happyWindow.Node;
  /** @type {any} */ (globalThis).navigator = {
    userAgent: "test-agent",
    sendBeacon: () => true,
  };

  // The page module registers its DOMContentLoaded handler as it is evaluated,
  // and `stripe.mjs` pulls in `error-reporting.mjs`, which needs a window. Both
  // have to exist before the import runs.
  await import("./manage.mjs");
});

afterAll(async () => {
  delete (/** @type {any} */ (globalThis).window);
  delete (/** @type {any} */ (globalThis).document);
  delete (/** @type {any} */ (globalThis).Node);
  delete (/** @type {any} */ (globalThis).navigator);
  await happyWindow.happyDOM.close();
});

const TIER_FORM = `
  <form class="donation-tier-form" action="/subscribe" method="post">
    <div class="tier-options">
      <input type="radio" name="tier" id="tier-10" value="1000" />
      <input type="radio" name="tier" id="tier-custom" value="custom" />
    </div>
    <input type="text" id="custom-amount" name="custom-amount"
           data-min="5" readonly />
    <button type="submit">Subscribe</button>
  </form>`;

const CANCEL_FORM = `
  <form class="cancel-subscription-form" action="/cancel" method="post">
    <button type="submit" class="btn btn-ghost btn-danger">
      <span class="btn-label">Cancel membership</span>
      <span class="btn-suffix">×</span>
    </button>
  </form>`;

/** @param {string} body */
function loadPage(body) {
  doc.body.innerHTML = body;
  doc.dispatchEvent(
    /** @type {Event} */ (
      /** @type {unknown} */ (new happyWindow.Event("DOMContentLoaded"))
    ),
  );
}

/** @returns {HTMLButtonElement} */
function cancelButton() {
  return /** @type {HTMLButtonElement} */ (
    doc.querySelector(".cancel-subscription-form button")
  );
}

/** @returns {HTMLSpanElement} */
function cancelLabel() {
  return /** @type {HTMLSpanElement} */ (
    doc.querySelector(".cancel-subscription-form .btn-label")
  );
}

/**
 * Click an element with a cancelable event so the handler's `preventDefault`
 * is observable without letting happy-dom submit the form.
 * @param {HTMLElement} el
 * @returns {boolean} Whether the default was prevented.
 */
function click(el) {
  const event = new happyWindow.MouseEvent("click", {
    bubbles: true,
    cancelable: true,
  });
  el.dispatchEvent(/** @type {Event} */ (/** @type {unknown} */ (event)));
  return event.defaultPrevented;
}

/**
 * @param {HTMLElement | Document} target
 * @param {string} type
 */
function fire(target, type) {
  target.dispatchEvent(
    /** @type {Event} */ (
      /** @type {unknown} */ (new happyWindow.Event(type, { bubbles: true }))
    ),
  );
}

describe("custom tier amount", () => {
  beforeEach(() => {
    loadPage(TIER_FORM + CANCEL_FORM);
  });

  it("unlocks the input when the custom tier is picked", () => {
    const customAmount = /** @type {HTMLInputElement} */ (
      doc.getElementById("custom-amount")
    );
    const customRadio = /** @type {HTMLInputElement} */ (
      doc.getElementById("tier-custom")
    );

    customRadio.checked = true;
    fire(customRadio, "change");

    expect(customAmount.readOnly).toBe(false);
  });

  it("validates the amount against the tier minimum", () => {
    const customAmount = /** @type {HTMLInputElement} */ (
      doc.getElementById("custom-amount")
    );

    customAmount.value = "2";
    fire(customAmount, "input");

    expect(customAmount.validationMessage).toInclude("below the minimum");
  });
});

describe("cancel button confirmation", () => {
  beforeEach(() => {
    loadPage(TIER_FORM + CANCEL_FORM);
  });

  it("swallows the first click and asks for confirmation", () => {
    expect(click(cancelButton())).toBe(true);
    expect(cancelLabel().textContent).toBe("Press again to confirm");
  });

  it("keeps the button suffix markup while armed", () => {
    click(cancelButton());

    expect(cancelButton().querySelector(".btn-suffix")?.textContent).toBe("×");
  });

  it("lets the second click through", () => {
    click(cancelButton());

    expect(click(cancelButton())).toBe(false);
  });

  it("resets when focus leaves the form", () => {
    click(cancelButton());

    fire(cancelButton(), "blur");

    expect(cancelLabel().textContent).toBe("Cancel membership");
    expect(click(cancelButton())).toBe(true);
  });

  it("resets on a pointerdown elsewhere on the page", () => {
    click(cancelButton());

    fire(
      /** @type {HTMLElement} */ (doc.querySelector(".donation-tier-form")),
      "pointerdown",
    );

    expect(cancelLabel().textContent).toBe("Cancel membership");
  });

  it("stays armed for a pointerdown inside the form", () => {
    click(cancelButton());

    fire(cancelButton(), "pointerdown");

    expect(cancelLabel().textContent).toBe("Press again to confirm");
  });

  it("ignores a pointerdown while it is not armed", () => {
    fire(
      /** @type {HTMLElement} */ (doc.querySelector(".donation-tier-form")),
      "pointerdown",
    );

    expect(cancelLabel().textContent).toBe("Cancel membership");
  });
});

describe("a page with no subscription to cancel", () => {
  it("wires up the tier form and nothing else", () => {
    loadPage(TIER_FORM);

    expect(doc.querySelector(".cancel-subscription-form")).toBeNull();
    expect(
      /** @type {HTMLInputElement} */ (doc.getElementById("custom-amount"))
        .readOnly,
    ).toBe(true);
  });
});
