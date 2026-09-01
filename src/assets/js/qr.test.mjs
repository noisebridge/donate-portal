// @ts-check
/// <reference types="bun-types" />
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from "bun:test";
import { Window } from "happy-dom";

/** @type {Window} */
let happyWindow;
/** @type {Document} */
let doc;

const ORIGINAL_HINT = "Minimum $1.00";

beforeAll(async () => {
  happyWindow = new Window({ url: "https://donate.example.com/qr" });
  doc = /** @type {Document} */ (/** @type {unknown} */ (happyWindow.document));
  /** @type {any} */ (globalThis).window = happyWindow;
  /** @type {any} */ (globalThis).document = doc;
  /** @type {any} */ (globalThis).navigator = {
    userAgent: "test-agent",
    sendBeacon: () => true,
  };

  // The page module registers its DOMContentLoaded handler as it is evaluated,
  // and `stripe.mjs` pulls in `error-reporting.mjs`, which needs a window. Both
  // have to exist before the import runs.
  await import("./qr.mjs");
});

afterAll(async () => {
  delete (/** @type {any} */ (globalThis).window);
  delete (/** @type {any} */ (globalThis).document);
  delete (/** @type {any} */ (globalThis).navigator);
  await happyWindow.happyDOM.close();
});

/**
 * Replace the page markup and re-run the module's DOMContentLoaded handler
 * against it, so each test starts from freshly wired-up elements.
 * @param {string} body
 */
function loadPage(body) {
  doc.body.innerHTML = body;
  doc.dispatchEvent(
    /** @type {Event} */ (
      /** @type {unknown} */ (new happyWindow.Event("DOMContentLoaded"))
    ),
  );
}

/**
 * @param {object} [options]
 * @param {string} [options.ticks]
 * @returns {string}
 */
function fullPage(options = {}) {
  const ticks =
    options.ticks ??
    `<button type="button" class="tick" data-amt="1"></button>
     <button type="button" class="tick" data-amt="10"></button>
     <button type="button" class="tick" data-amt="500"></button>`;

  return `
    <form id="donate-form" action="/donate" method="post">
      <input type="checkbox" id="custom-toggle" />
      <input type="text" id="name" value="Original name" readonly />
      <textarea id="description" readonly>Original description</textarea>
      <input type="text" id="amount-input" name="amount-dollars"
             value="10.00" data-min="1" />
      <span id="amount-hint">${ORIGINAL_HINT}</span>
      <input type="range" id="amount-slider" min="1" max="500" step="1"
             value="10" />
      <div id="slider-ticks">${ticks}</div>
      <button type="submit"><span id="donate-label">Donate · $10.00</span></button>
    </form>`;
}

/** @returns {HTMLInputElement} */
function amountInput() {
  return /** @type {HTMLInputElement} */ (doc.getElementById("amount-input"));
}

/** @returns {HTMLInputElement} */
function slider() {
  return /** @type {HTMLInputElement} */ (doc.getElementById("amount-slider"));
}

/** @returns {string} */
function hint() {
  return doc.getElementById("amount-hint")?.textContent ?? "";
}

/**
 * @param {HTMLElement} el
 * @param {string} type
 */
function fire(el, type) {
  el.dispatchEvent(
    /** @type {Event} */ (
      /** @type {unknown} */ (new happyWindow.Event(type, { bubbles: true }))
    ),
  );
}

/** @param {string} value */
function typeAmount(value) {
  amountInput().value = value;
  fire(amountInput(), "input");
}

describe("pages without the amount markup", () => {
  it("wires up nothing and does not throw", () => {
    const error = jest.spyOn(console, "error").mockImplementation(() => {});

    loadPage(
      `<form id="donate-form" action="/donate"><button type="submit">Go</button></form>`,
    );

    expect(error).not.toHaveBeenCalled();
    error.mockRestore();
  });
});

describe("amount controls", () => {
  beforeEach(() => {
    loadPage(fullPage());
  });

  it("seeds the button label and slider from the input", () => {
    expect(doc.getElementById("donate-label")?.textContent).toBe(
      "Donate · $10.00",
    );
    expect(slider().value).toBe("10");
  });

  it("moving the slider updates the input, label and hint", () => {
    slider().value = "42";
    fire(slider(), "input");

    expect(amountInput().value).toBe("42.00");
    expect(doc.getElementById("donate-label")?.textContent).toBe(
      "Donate · $42.00",
    );
    expect(hint()).toBe("Thanks for all the fish! 🐬");
  });

  it("clamps the slider to its range for out-of-range amounts", () => {
    typeAmount("1200");
    fire(amountInput(), "blur");

    expect(slider().value).toBe("500");
    expect(amountInput().value).toBe("1200.00");
  });

  it("keeps the last valid amount while the input is empty", () => {
    const hintBefore = hint();

    typeAmount("");
    expect(hint()).toBe(hintBefore);

    fire(amountInput(), "blur");
    expect(amountInput().value).toBe("10.00");
  });

  it("restores the original hint for amounts with no suggestion", () => {
    typeAmount("7");

    expect(hint()).toBe(ORIGINAL_HINT);
  });

  it("positions each tick along the track", () => {
    const ticks = doc.querySelectorAll("#slider-ticks .tick");
    expect(
      /** @type {HTMLElement} */ (ticks[0]).style.getPropertyValue("--frac"),
    ).toBe("0");
    expect(
      /** @type {HTMLElement} */ (ticks[2]).style.getPropertyValue("--frac"),
    ).toBe("1");
  });

  it("clicking a tick selects that preset", () => {
    /** @type {HTMLElement} */ (
      doc.querySelectorAll("#slider-ticks .tick")[2]
    ).click();

    expect(amountInput().value).toBe("500.00");
    expect(doc.getElementById("donate-label")?.textContent).toBe(
      "Donate · $500.00",
    );
  });
});

describe("ticks without a usable amount", () => {
  it("are left unpositioned and inert", () => {
    loadPage(
      fullPage({
        ticks: `<button type="button" class="tick"></button>
                <button type="button" class="tick" data-amt="lots"></button>`,
      }),
    );

    const ticks = doc.querySelectorAll("#slider-ticks .tick");
    for (const tick of ticks) {
      const element = /** @type {HTMLElement} */ (tick);
      expect(element.style.getPropertyValue("--frac")).toBe("");
      element.click();
    }

    expect(amountInput().value).toBe("10.00");
  });
});

describe("custom toggle", () => {
  /** @returns {HTMLInputElement} */
  function toggle() {
    return /** @type {HTMLInputElement} */ (
      doc.getElementById("custom-toggle")
    );
  }

  /** @returns {HTMLInputElement} */
  function nameInput() {
    return /** @type {HTMLInputElement} */ (doc.getElementById("name"));
  }

  /** @returns {HTMLTextAreaElement} */
  function descriptionInput() {
    return /** @type {HTMLTextAreaElement} */ (
      doc.getElementById("description")
    );
  }

  beforeEach(() => {
    loadPage(fullPage());
  });

  it("refuses focus on the locked fields", () => {
    const nameBlur = jest.spyOn(nameInput(), "blur");
    const descriptionBlur = jest.spyOn(descriptionInput(), "blur");

    fire(nameInput(), "focus");
    fire(descriptionInput(), "focus");

    expect(nameBlur).toHaveBeenCalled();
    expect(descriptionBlur).toHaveBeenCalled();
  });

  it("unlocks the fields and focuses the name when turned on", () => {
    jest.useFakeTimers();
    const focus = jest.spyOn(nameInput(), "focus");

    toggle().checked = true;
    fire(toggle(), "change");

    expect(nameInput().readOnly).toBe(false);
    expect(descriptionInput().readOnly).toBe(false);

    jest.advanceTimersByTime(50);
    expect(focus).toHaveBeenCalled();

    fire(nameInput(), "focus");
    jest.useRealTimers();
  });

  it("restores the original values when turned back off", () => {
    toggle().checked = true;
    fire(toggle(), "change");
    nameInput().value = "Edited";
    descriptionInput().value = "Edited too";

    toggle().checked = false;
    fire(toggle(), "change");

    expect(nameInput().readOnly).toBe(true);
    expect(nameInput().value).toBe("Original name");
    expect(descriptionInput().value).toBe("Original description");
  });
});
