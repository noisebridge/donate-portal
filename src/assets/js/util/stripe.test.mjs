// @ts-check
/// <reference types="bun-types" />
import {
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from "bun:test";
import { Window } from "happy-dom";

/** @type {typeof import("./stripe.mjs")} */
let stripe;

beforeAll(async () => {
  // `error-reporting.mjs`, pulled in transitively by the module under test,
  // registers window listeners as soon as it is evaluated, so a window has to
  // exist before the import runs. `beforeEach` replaces this stub with a real
  // happy-dom window.
  /** @type {any} */ (globalThis).window = { addEventListener: () => {} };
  stripe = await import("./stripe.mjs");
});

/** @type {Window} */
let happyWindow;
/** @type {Document} */
let doc;
/** @type {any} */
let paymentElement;
/** @type {any} */
let embeddedCheckout;
/** @type {Record<string, (arg: any) => void>} */
let paymentElementHandlers;
/** @type {any} */
let sendBeacon;

// The module caches its Stripe.js promise in module scope and there is no way
// to reset it, so every test after the first successful load resolves to this
// same object. It is created once and its mocks are reset per test.
const stripeJs = {
  elements: jest.fn(() => ({ create: jest.fn(() => paymentElement) })),
  createEmbeddedCheckoutPage: jest.fn(async () => embeddedCheckout),
  confirmPayment: jest.fn(async () => /** @type {any} */ ({ error: null })),
};

/** Let pending microtasks and zero-delay timers run. */
function flush() {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

function buildDOM() {
  doc.head.innerHTML = `<meta name="stripe-public" content="pk_test_123" />`;
  doc.body.innerHTML = `
    <div id="stripe-checkout-modal" hidden>
      <div class="checkout-modal-backdrop"></div>
      <button class="checkout-modal-close" type="button">Close</button>
      <div id="payment-element"></div>
      <p id="payment-message" hidden></p>
      <button id="payment-submit" type="button">Pay</button>
    </div>
    <form id="donate-form" action="/donate" method="post">
      <input name="amount-dollars" value="10" />
      <button type="submit">Donate</button>
    </form>`;
}

/**
 * Build the window the module under test runs against.
 *
 * `handleDisabledFileLoadingAsSuccess` makes happy-dom dispatch `load` on the
 * injected Stripe.js `<script>` as it is appended; turning it off makes
 * happy-dom dispatch `error` instead, which is how the failed-load path is
 * reached. happy-dom fires both synchronously, so appends into `<head>` are
 * deferred by a microtask to match a browser, where the module has finished
 * caching its promise before either event arrives.
 * @param {boolean} scriptLoads
 */
function makeWindow(scriptLoads) {
  happyWindow = new Window({
    url: "https://donate.example.com/",
    settings: {
      disableJavaScriptFileLoading: true,
      handleDisabledFileLoadingAsSuccess: scriptLoads,
    },
  });
  doc = /** @type {Document} */ (/** @type {unknown} */ (happyWindow.document));

  /** @type {any} */ (happyWindow).Stripe = jest.fn(() => stripeJs);
  /** @type {any} */ (globalThis).window = happyWindow;
  /** @type {any} */ (globalThis).document = doc;
  /** @type {any} */ (globalThis).FormData = happyWindow.FormData;

  const head = doc.head;
  const append = head.appendChild.bind(head);
  /** @type {any} */ (head).appendChild = (/** @type {Node} */ node) => {
    queueMicrotask(() => append(node));
    return node;
  };

  buildDOM();
}

/** @returns {HTMLFormElement} */
function form() {
  return /** @type {HTMLFormElement} */ (doc.getElementById("donate-form"));
}

/** @returns {HTMLButtonElement} */
function submitButton() {
  return /** @type {HTMLButtonElement} */ (
    doc.querySelector("#donate-form button")
  );
}

/** @param {HTMLFormElement} target */
function fireSubmit(target) {
  target.dispatchEvent(
    /** @type {Event} */ (
      /** @type {unknown} */ (
        new happyWindow.Event("submit", { bubbles: true, cancelable: true })
      )
    ),
  );
}

/**
 * Stub `fetch` with a single JSON response.
 * @param {unknown} body
 * @param {{ ok?: boolean }} [options]
 */
function stubFetchJson(body, options = {}) {
  const response = {
    ok: options.ok ?? true,
    statusText: "Bad Request",
    json: async () => body,
  };
  /** @type {any} */ (globalThis).fetch = jest.fn(async () => response);
}

/**
 * Submit the checkout form and let the response be handled.
 * @param {"donate" | "subscribe"} type
 * @param {unknown} body
 */
async function submitCheckout(type, body) {
  stripe.initCheckoutForm(form(), type);
  stubFetchJson(body);
  fireSubmit(form());
  await flush();
}

beforeEach(() => {
  paymentElementHandlers = {};
  paymentElement = {
    on: jest.fn((/** @type {string} */ name, /** @type {any} */ handler) => {
      paymentElementHandlers[name] = handler;
    }),
    mount: jest.fn(),
    destroy: jest.fn(),
  };
  embeddedCheckout = { mount: jest.fn(), destroy: jest.fn() };
  stripeJs.elements.mockClear();
  stripeJs.createEmbeddedCheckoutPage.mockClear();
  stripeJs.confirmPayment.mockClear();
  stripeJs.confirmPayment.mockImplementation(async () => ({ error: null }));

  sendBeacon = jest.fn(() => true);
  /** @type {any} */ (globalThis).navigator = {
    userAgent: "test-agent",
    sendBeacon,
  };

  makeWindow(true);
});

afterEach(async () => {
  delete (/** @type {any} */ (globalThis).window);
  delete (/** @type {any} */ (globalThis).document);
  delete (/** @type {any} */ (globalThis).navigator);
  delete (/** @type {any} */ (globalThis).FormData);
  delete (/** @type {any} */ (globalThis).fetch);
  await happyWindow.happyDOM.close();
});

// Runs first: the module-scope `elements` handle is still null here, and later
// tests set it by opening a donation checkout.
describe("payment submit before a checkout has been opened", () => {
  it("does nothing", async () => {
    stripe.initCheckoutForm(form(), "donate");

    /** @type {HTMLElement} */ (doc.getElementById("payment-submit")).click();
    await flush();

    expect(stripeJs.confirmPayment).not.toHaveBeenCalled();
  });
});

// Runs before anything that loads Stripe.js successfully, because the module
// caches the resolved promise for the lifetime of the page.
describe("initStripe", () => {
  it("throws when the public key meta tag is missing", () => {
    doc.head.innerHTML = "";

    expect(() => stripe.initStripe()).toThrow("Stripe public key not found");
  });

  it("rejects with an Error when the script fails to load", async () => {
    await happyWindow.happyDOM.close();
    makeWindow(false);

    // Must be a real Error, not the event's absent `error` property: callers
    // only forward rejections to error reporting when `instanceof Error`.
    expect(stripe.initStripe()).rejects.toThrow("Failed to load Stripe.js");
    await flush();
  });

  it("rejects when the script loads without defining window.Stripe", async () => {
    delete (/** @type {any} */ (happyWindow).Stripe);

    expect(stripe.initStripe()).rejects.toThrow("window.Stripe is undefined");
    await flush();
  });

  it("resolves with the Stripe instance and caches the promise", async () => {
    const first = stripe.initStripe();
    const second = stripe.initStripe();

    expect(second).toBe(first);
    expect(await first).toBe(/** @type {any} */ (stripeJs));
    expect(doc.head.querySelectorAll("script")).toHaveLength(1);
    expect(/** @type {any} */ (happyWindow).Stripe).toHaveBeenCalledWith(
      "pk_test_123",
    );
  });

  it("reuses the cached promise on a later page", async () => {
    expect(await stripe.initStripe()).toBe(/** @type {any} */ (stripeJs));
    expect(doc.head.querySelectorAll("script")).toHaveLength(0);
  });
});

describe("startLoading", () => {
  it("swaps the label for loading bars and restores it", () => {
    const button = submitButton();

    const stop = stripe.startLoading(button);
    expect(button.disabled).toBe(true);
    expect(button.querySelectorAll(".loading-block-bar")).toHaveLength(5);

    stop();
    expect(button.disabled).toBe(false);
    expect(button.textContent).toBe("Donate");
  });
});

describe("initDonationCheckout", () => {
  it("mounts a payment element and opens the modal", async () => {
    await stripe.initDonationCheckout("cs_test_secret", "donor@example.com");

    expect(stripeJs.elements).toHaveBeenCalledWith({
      clientSecret: "cs_test_secret",
    });
    expect(paymentElement.mount).toHaveBeenCalled();
    expect(doc.getElementById("stripe-checkout-modal")?.hidden).toBe(false);
    expect(doc.body.style.overflow).toBe("hidden");
  });

  it("skips mounting when the mount point is absent", async () => {
    doc.getElementById("payment-element")?.remove();

    await stripe.initDonationCheckout("cs_test_secret", null);

    expect(paymentElement.mount).not.toHaveBeenCalled();
  });

  it("shows the message element when the payment element fails to load", async () => {
    await stripe.initDonationCheckout("cs_test_secret", null);

    /** @type {any} */ (paymentElementHandlers)["loaderror"]({
      error: { message: "Card network unavailable" },
    });

    const message = /** @type {HTMLElement} */ (
      doc.getElementById("payment-message")
    );
    expect(message.textContent).toBe("Card network unavailable");
    expect(message.hidden).toBe(false);
  });

  it("escaping the payment element closes the modal and destroys it", async () => {
    await stripe.initDonationCheckout("cs_test_secret", null);

    /** @type {any} */ (paymentElementHandlers)["escape"]();

    expect(doc.getElementById("stripe-checkout-modal")?.hidden).toBe(true);
    expect(doc.body.style.overflow).toBe("");
    expect(paymentElement.destroy).toHaveBeenCalled();
  });

  it("leaves the page alone when the modal markup is missing", async () => {
    doc.getElementById("stripe-checkout-modal")?.remove();

    await stripe.initDonationCheckout("cs_test_secret", null);

    expect(doc.body.style.overflow).toBe("");
  });
});

describe("initSubscriptionCheckout", () => {
  it("mounts embedded checkout in the modal", async () => {
    await stripe.initSubscriptionCheckout("cs_test_secret");

    expect(stripeJs.createEmbeddedCheckoutPage).toHaveBeenCalledWith({
      clientSecret: "cs_test_secret",
    });
    expect(embeddedCheckout.mount).toHaveBeenCalled();
    expect(doc.getElementById("stripe-checkout-modal")?.hidden).toBe(false);
  });

  it("does nothing when the mount point is absent", async () => {
    doc.getElementById("payment-element")?.remove();

    await stripe.initSubscriptionCheckout("cs_test_secret");

    expect(stripeJs.createEmbeddedCheckoutPage).not.toHaveBeenCalled();
  });
});

describe("initCheckoutForm", () => {
  it("bails out when the form has no submit button", () => {
    const error = jest.spyOn(console, "error").mockImplementation(() => {});

    const empty = /** @type {HTMLFormElement} */ (doc.createElement("form"));
    stripe.initCheckoutForm(empty, "donate");
    fireSubmit(empty);

    expect(error).toHaveBeenCalled();
    error.mockRestore();
  });

  it("reports a failed request and restores the button", async () => {
    const error = jest.spyOn(console, "error").mockImplementation(() => {});
    /** @type {any} */ (globalThis).fetch = jest.fn(async () => {
      throw new Error("network down");
    });

    stripe.initCheckoutForm(form(), "donate");
    fireSubmit(form());
    await flush();

    expect(sendBeacon).toHaveBeenCalled();
    expect(submitButton().disabled).toBe(false);
    error.mockRestore();
  });

  it("does not report a non-Error rejection", async () => {
    const error = jest.spyOn(console, "error").mockImplementation(() => {});
    /** @type {any} */ (globalThis).fetch = jest.fn(async () => {
      throw "just a string";
    });

    stripe.initCheckoutForm(form(), "donate");
    fireSubmit(form());
    await flush();

    expect(sendBeacon).not.toHaveBeenCalled();
    error.mockRestore();
  });

  it("stops on a non-OK response without reporting an error", async () => {
    const error = jest.spyOn(console, "error").mockImplementation(() => {});
    stripe.initCheckoutForm(form(), "donate");
    stubFetchJson({}, { ok: false });
    fireSubmit(form());
    await flush();

    expect(sendBeacon).not.toHaveBeenCalled();
    expect(submitButton().disabled).toBe(false);
    error.mockRestore();
  });

  it("follows a redirect response", async () => {
    await submitCheckout("donate", { redirect: "/auth" });

    expect(happyWindow.location.pathname).toBe("/auth");
  });

  it("opens the donation checkout for a client secret", async () => {
    await submitCheckout("donate", {
      clientSecret: "cs_1",
      emailAddress: "a@example.com",
    });

    expect(stripeJs.elements).toHaveBeenCalledWith({ clientSecret: "cs_1" });
  });

  it("opens embedded checkout for a subscription form", async () => {
    await submitCheckout("subscribe", {
      clientSecret: "cs_2",
      emailAddress: null,
    });

    expect(stripeJs.createEmbeddedCheckoutPage).toHaveBeenCalledWith({
      clientSecret: "cs_2",
    });
  });

  const invalidPayloads = /** @type {[string, unknown][]} */ ([
    ["a non-object", "nope"],
    ["an array", []],
    ["null", null],
    ["an object with no usable keys", { other: 1 }],
    ["a non-string redirect", { redirect: 5 }],
    ["a non-string clientSecret", { clientSecret: 5, emailAddress: null }],
    ["a missing emailAddress", { clientSecret: "cs_3" }],
    ["a non-string emailAddress", { clientSecret: "cs_3", emailAddress: 5 }],
  ]);

  for (const [label, payload] of invalidPayloads) {
    it(`rejects ${label}`, async () => {
      const error = jest.spyOn(console, "error").mockImplementation(() => {});
      jest.spyOn(console, "debug").mockImplementation(() => {});

      await submitCheckout("donate", payload);

      expect(error).toHaveBeenCalled();
      expect(stripeJs.elements).not.toHaveBeenCalled();
      expect(stripeJs.createEmbeddedCheckoutPage).not.toHaveBeenCalled();
      expect(submitButton().disabled).toBe(false);
      error.mockRestore();
    });
  }
});

describe("checkout modal controls", () => {
  it("destroys embedded checkout when the backdrop is clicked", async () => {
    await submitCheckout("subscribe", {
      clientSecret: "cs_1",
      emailAddress: null,
    });

    /** @type {HTMLElement} */ (
      doc.querySelector(".checkout-modal-backdrop")
    ).click();

    expect(embeddedCheckout.destroy).toHaveBeenCalled();
  });

  it("closes on the close button", async () => {
    await submitCheckout("donate", {
      clientSecret: "cs_1",
      emailAddress: null,
    });

    /** @type {HTMLElement} */ (
      doc.querySelector(".checkout-modal-close")
    ).click();

    expect(doc.getElementById("stripe-checkout-modal")?.hidden).toBe(true);
  });

  it("closes on Escape", async () => {
    await submitCheckout("donate", {
      clientSecret: "cs_1",
      emailAddress: null,
    });

    pressKey("Escape");

    expect(doc.getElementById("stripe-checkout-modal")?.hidden).toBe(true);
  });

  it("ignores other keys", async () => {
    await submitCheckout("donate", {
      clientSecret: "cs_1",
      emailAddress: null,
    });

    pressKey("Enter");

    expect(doc.getElementById("stripe-checkout-modal")?.hidden).toBe(false);
  });

  it("confirms the payment and surfaces the returned error", async () => {
    await submitCheckout("donate", {
      clientSecret: "cs_1",
      emailAddress: null,
    });
    stripeJs.confirmPayment.mockImplementation(async () => ({
      error: { message: "Your card was declined." },
    }));

    /** @type {HTMLElement} */ (doc.getElementById("payment-submit")).click();
    await flush();

    expect(stripeJs.confirmPayment).toHaveBeenCalledWith({
      elements: expect.anything(),
      confirmParams: { return_url: "https://donate.example.com/thank-you" },
    });
    expect(doc.getElementById("payment-message")?.textContent).toBe(
      "Your card was declined.",
    );
    expect(
      /** @type {HTMLButtonElement} */ (doc.getElementById("payment-submit"))
        .disabled,
    ).toBe(false);
  });

  it("falls back to a generic message when Stripe gives none", async () => {
    await submitCheckout("donate", {
      clientSecret: "cs_1",
      emailAddress: null,
    });
    stripeJs.confirmPayment.mockImplementation(async () => ({ error: {} }));

    /** @type {HTMLElement} */ (doc.getElementById("payment-submit")).click();
    await flush();

    expect(doc.getElementById("payment-message")?.textContent).toBe(
      "Payment failed. Please try again.",
    );
  });

  it("leaves the submit button disabled when the payment succeeds", async () => {
    await submitCheckout("donate", {
      clientSecret: "cs_1",
      emailAddress: null,
    });

    /** @type {HTMLElement} */ (doc.getElementById("payment-submit")).click();
    await flush();

    expect(doc.getElementById("payment-message")?.hidden).toBe(true);
    expect(
      /** @type {HTMLButtonElement} */ (doc.getElementById("payment-submit"))
        .disabled,
    ).toBe(true);
  });
});

/** @param {string} key */
function pressKey(key) {
  doc.dispatchEvent(
    /** @type {Event} */ (
      /** @type {unknown} */ (new happyWindow.KeyboardEvent("keydown", { key }))
    ),
  );
}
