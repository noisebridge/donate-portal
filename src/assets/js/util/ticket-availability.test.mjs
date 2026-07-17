// @ts-check
/// <reference types="bun-types" />
import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test";
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
const fetchMock = mock(() => Promise.resolve(new Response()));

/** @param {import("~/managers/ticketing").TicketAvailability} availability */
function mockAvailability(availability) {
  fetchMock.mockResolvedValue(
    new Response(JSON.stringify(availability), {
      headers: { "Content-Type": "application/json" },
    }),
  );
}

beforeEach(() => {
  happyWindow = new Window({ url: "https://example.com/afterparty" });
  doc = /** @type {Document} */ (/** @type {unknown} */ (happyWindow.document));
  Object.defineProperty(globalThis, "document", {
    configurable: true,
    value: doc,
  });
  fetchMock.mockReset();
  Object.defineProperty(globalThis, "fetch", {
    configurable: true,
    value: fetchMock,
  });
  doc.body.innerHTML = `
    <p id="ticket-count">Checking availability…</p>
    <div id="ticket-status" hidden>
      <span id="ticket-status-text"></span>
      <button id="ticket-availability-retry" type="button" hidden>Check again</button>
    </div>
    <form
      id="afterparty-form"
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
  Reflect.deleteProperty(globalThis, "fetch");
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
    mockAvailability({ capacity: 150, sold: 145, claimed: 145, remaining: 5 });
    const result = initTicketAvailability(form, { enable, disable });

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
    mockAvailability({ capacity: 150, sold: 3, claimed: 3, remaining: 147 });
    const result = initTicketAvailability(form, { enable, disable });

    await result?.ready;

    expect(enableCalls).toEqual([20]);
  });

  it("keeps checkout blocked when tickets are sold out", async () => {
    mockAvailability({ capacity: 150, sold: 150, claimed: 150, remaining: 0 });
    const result = initTicketAvailability(form, { enable, disable });

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
    mockAvailability({ capacity: 150, sold: 149, claimed: 150, remaining: 0 });
    const result = initTicketAvailability(form, { enable, disable });

    await result?.ready;

    expect(doc.getElementById("ticket-count")?.textContent).toBe(
      "149 of 150 sold",
    );
    expect(doc.getElementById("ticket-status-text")?.textContent).toContain(
      "currently held in checkout",
    );
  });

  it("stays blocked and offers retry when availability fails", async () => {
    fetchMock.mockRejectedValue(new Error("Network error"));
    const result = initTicketAvailability(form, { enable, disable });

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
});
