// @ts-check
/// <reference types="bun-types" />
import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { Window } from "happy-dom";
import {
  initTicketAvailability,
  isTicketAvailability,
} from "./ticket-availability.mjs";

/** @type {Window} */
let happyWindow;
/** @type {Document} */
let doc;
/** @type {HTMLFormElement} */
let form;
/** @type {(maxQuantity: number) => void} */
let enable;
/** @type {(label: string) => void} */
let disable;
/** @type {number[]} */
let enableCalls;
/** @type {string[]} */
let disableCalls;

beforeEach(() => {
  happyWindow = new Window({ url: "https://example.com/afterparty" });
  doc = /** @type {Document} */ (/** @type {unknown} */ (happyWindow.document));
  Object.defineProperty(globalThis, "document", {
    configurable: true,
    value: doc,
  });
  doc.body.innerHTML = `
    <p id="ticket-count">Checking availability…</p>
    <div id="ticket-status" hidden>
      <span id="ticket-status-text"></span>
      <button id="ticket-availability-retry" type="button" hidden>Check again</button>
    </div>
    <form
      id="afterparty-form"
      data-availability-url="/afterparty/availability"
      data-max-quantity="20"
      aria-busy="true"
    >
      <input id="email" disabled>
      <button type="submit" disabled>Checking availability…</button>
    </form>
  `;
  form = /** @type {HTMLFormElement} */ (doc.getElementById("afterparty-form"));
  enableCalls = [];
  disableCalls = [];
  enable = (maxQuantity) => enableCalls.push(maxQuantity);
  disable = (label) => disableCalls.push(label);
});

afterEach(async () => {
  Reflect.deleteProperty(globalThis, "document");
  await happyWindow.happyDOM.close();
});

describe("isTicketAvailability", () => {
  it("accepts a consistent availability response", () => {
    expect(
      isTicketAvailability({
        capacity: 150,
        sold: 100,
        claimed: 105,
        remaining: 45,
      }),
    ).toBe(true);
  });

  it("rejects malformed and internally inconsistent responses", () => {
    expect(isTicketAvailability(null)).toBe(false);
    expect(isTicketAvailability([])).toBe(false);
    expect(
      isTicketAvailability({
        capacity: 150,
        sold: 100,
        claimed: 90,
        remaining: 60,
      }),
    ).toBe(false);
    expect(
      isTicketAvailability({
        capacity: 150,
        sold: 100,
        claimed: 105,
        remaining: 46,
      }),
    ).toBe(false);
  });
});

describe("initTicketAvailability", () => {
  it("unlocks checkout only after valid availability loads", async () => {
    const result = initTicketAvailability(
      form,
      { enable, disable },
      async () => ({ capacity: 150, sold: 145, claimed: 145, remaining: 5 }),
    );

    await result?.ready;

    expect(doc.getElementById("ticket-count")?.textContent).toBe(
      "145 of 150 sold",
    );
    expect(enableCalls).toEqual([5]);
    expect(
      /** @type {HTMLInputElement} */ (form.querySelector("#email")).disabled,
    ).toBe(false);
    expect(
      /** @type {HTMLButtonElement} */ (
        form.querySelector('button[type="submit"]')
      ).disabled,
    ).toBe(false);
    expect(form.getAttribute("aria-busy")).toBe("false");
  });

  it("caps the selector at the configured per-order maximum", async () => {
    const result = initTicketAvailability(
      form,
      { enable, disable },
      async () => ({ capacity: 150, sold: 3, claimed: 3, remaining: 147 }),
    );

    await result?.ready;

    expect(enableCalls).toEqual([20]);
  });

  it("keeps checkout blocked when tickets are sold out", async () => {
    const result = initTicketAvailability(
      form,
      { enable, disable },
      async () => ({ capacity: 150, sold: 150, claimed: 150, remaining: 0 }),
    );

    await result?.ready;

    expect(form.hidden).toBe(true);
    expect(doc.getElementById("ticket-status-text")?.textContent).toBe(
      "Sold out.",
    );
    expect(enableCalls).toEqual([]);
    expect(
      /** @type {HTMLButtonElement} */ (
        form.querySelector('button[type="submit"]')
      ).disabled,
    ).toBe(true);
  });

  it("distinguishes temporary checkout holds from sold tickets", async () => {
    const result = initTicketAvailability(
      form,
      { enable, disable },
      async () => ({ capacity: 150, sold: 149, claimed: 150, remaining: 0 }),
    );

    await result?.ready;

    expect(doc.getElementById("ticket-count")?.textContent).toBe(
      "149 of 150 sold",
    );
    expect(doc.getElementById("ticket-status-text")?.textContent).toContain(
      "currently held in checkout",
    );
  });

  it("stays blocked and offers retry when availability fails", async () => {
    const result = initTicketAvailability(
      form,
      { enable, disable },
      async () => {
        throw new Error("Network error");
      },
    );

    await result?.ready;

    expect(doc.getElementById("ticket-count")?.textContent).toBe(
      "Availability unavailable",
    );
    expect(doc.getElementById("ticket-availability-retry")?.hidden).toBe(false);
    expect(enableCalls).toEqual([]);
    expect(disableCalls[disableCalls.length - 1]).toBe(
      "Availability unavailable",
    );
    expect(
      /** @type {HTMLButtonElement} */ (
        form.querySelector('button[type="submit"]')
      ).disabled,
    ).toBe(true);
  });

  it("ignores an older response after a retry completes", async () => {
    /** @type {(value: { capacity: number, sold: number, claimed: number, remaining: number }) => void} */
    let resolveFirst = () => {};
    /** @type {Promise<{ capacity: number, sold: number, claimed: number, remaining: number }>} */
    const first = new Promise((resolve) => {
      resolveFirst = resolve;
    });
    let calls = 0;
    const result = initTicketAvailability(
      form,
      { enable, disable },
      async () => {
        calls += 1;
        if (calls === 1) {
          return await first;
        }
        return { capacity: 150, sold: 20, claimed: 20, remaining: 130 };
      },
    );

    await result?.reload();
    resolveFirst({ capacity: 150, sold: 10, claimed: 10, remaining: 140 });
    await result?.ready;

    expect(doc.getElementById("ticket-count")?.textContent).toBe(
      "20 of 150 sold",
    );
  });
});
