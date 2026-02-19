// @ts-check

import {
  initConfetti,
  launchConfetti,
  stopConfetti,
} from "./util/confetti.mjs";
import { initMatrix, showMatrix, stopMatrix } from "./util/matrix.mjs";

/** @typedef {import("~/managers/charge-alert").ChargeAlert} ChargeAlert */
/** @typedef {import("~/money").Cents} Cents */

const effectCanvas = /** @type {HTMLCanvasElement} */ (
  document.getElementById("effect-canvas")
);
const amountEl = /** @type {HTMLElement} */ (
  document.getElementById("alert-amount")
);
const productEl = /** @type {HTMLElement} */ (
  document.getElementById("alert-product")
);
const dateEl = /** @type {HTMLElement} */ (
  document.getElementById("alert-date")
);
const container = /** @type {HTMLElement} */ (
  document.querySelector(".alerts-container")
);
const historyList = /** @type {HTMLElement} */ (
  document.getElementById("history-list")
);
const wsPath = /** @type {HTMLInputElement} */ (
  document.getElementById("alerts-ws-path")
).value;

const MAX_RECONNECT_DELAY = 30000;
const DEFAULT_RECONNECT_DELAY = 1000;
const MAX_HISTORY = 20;
const HACKER_AMOUNTS = [1337, 13370, 133700];

let reconnectDelay = DEFAULT_RECONNECT_DELAY;

/**
 * Format cents as a dollar amount.
 * @param {Cents} amount
 * @returns {string}
 */
function formatAmount(amount) {
  return `$${(amount.cents / 100).toFixed(2)}`;
}

/**
 * Create a span element with the given class and text content.
 * @param {string} className
 * @param {string} text
 * @returns {HTMLSpanElement}
 */
function span(className, text) {
  const el = document.createElement("span");
  el.className = className;
  el.textContent = text;

  return el;
}

/**
 * Build an amount element with aligned dollar/cent spans.
 * @param {Cents} amount
 * @returns {HTMLSpanElement}
 */
function buildAmountAligned(amount) {
  const parts = (amount.cents / 100).toFixed(2).split(".");
  const dollars = /** @type {string} */ (parts[0]);
  const cents = /** @type {string} */ (parts[1]);

  const wrapper = document.createElement("span");
  wrapper.className = "history-amount";
  wrapper.append(
    span("history-amount-dollars", `$${dollars}.`),
    span("history-amount-cents", cents),
  );

  return wrapper;
}

/**
 * Format an ISO date string for display.
 * @param {string} isoDate
 * @returns {string}
 */
function formatDate(isoDate) {
  return new Date(isoDate).toLocaleString("en-US", {
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "numeric",
    timeZone: "America/Los_Angeles",
  });
}

/**
 * Check whether an alert ID is already displayed.
 * @param {string} id
 * @returns {boolean}
 */
function seenAlert(id) {
  return (
    currentCharge?.id === id ||
    historyList.querySelector(`[data-alert-id="${CSS.escape(id)}"]`) !== null
  );
}

/**
 * Push the current alert into the history list.
 * @param {ChargeAlert} alert
 */
function addToHistory(alert) {
  const item = document.createElement("div");
  item.className = "history-item";
  item.dataset["alertId"] = alert.id;
  item.append(
    span("history-product", alert.productName),
    buildAmountAligned(alert.amount),
    span("history-date", formatDate(alert.date)),
  );

  historyList.prepend(item);

  while (historyList.children.length > MAX_HISTORY) {
    historyList.removeChild(/** @type {Node} */ (historyList.lastChild));
  }
}

/**
 * @param {ChargeAlert} alert
 */
function setBodyClass(alert) {
  document.body.classList.toggle(
    "hacker",
    HACKER_AMOUNTS.includes(alert.amount.cents),
  );
}

/** @type {ChargeAlert | null} */
let currentCharge = null;

/**
 * Update the DOM with a new charge alert.
 * @param {ChargeAlert} alert
 */
function displayAlert(alert) {
  if (seenAlert(alert.id)) {
    return;
  }

  setBodyClass(alert);

  if (currentCharge) {
    addToHistory(currentCharge);
  }
  currentCharge = alert;

  amountEl.textContent = formatAmount(alert.amount);
  productEl.textContent = alert.productName;
  dateEl.textContent = formatDate(alert.date);

  const animatedEls = [amountEl, productEl, dateEl];
  for (const el of animatedEls) {
    el.classList.remove("alert-animate");
  }
  // Force reflow to restart animation
  void container.offsetWidth;
  for (const el of animatedEls) {
    el.classList.add("alert-animate");
  }

  if (HACKER_AMOUNTS.includes(alert.amount.cents)) {
    stopConfetti();
    showMatrix();
  } else {
    stopMatrix();
    launchConfetti(alert.amount.cents / 100);
  }
}

function connect() {
  const protocol = location.protocol === "https:" ? "wss:" : "ws:";
  const url = `${protocol}//${location.host}${wsPath}`;

  const ws = new WebSocket(url);
  ws.addEventListener("open", () => {
    reconnectDelay = DEFAULT_RECONNECT_DELAY;
  });
  ws.addEventListener("message", (event) => {
    const alert = /** @type {ChargeAlert} */ (JSON.parse(event.data));
    displayAlert(alert);
  });
  ws.addEventListener("close", () => {
    setTimeout(() => {
      reconnectDelay = Math.min(reconnectDelay * 2, MAX_RECONNECT_DELAY);
      connect();
    }, reconnectDelay);
  });
}

/**
 * Initialize a full-screen canvas element with auto-resize.
 * @param {HTMLCanvasElement} canvasEl
 * @returns {HTMLCanvasElement}
 */
function initCanvas(canvasEl) {
  function resize() {
    canvasEl.width = window.innerWidth;
    canvasEl.height = window.innerHeight;
  }

  window.addEventListener("resize", resize);
  resize();

  return canvasEl;
}

document.addEventListener("DOMContentLoaded", () => {
  const canvas = initCanvas(effectCanvas);
  initConfetti(canvas);
  initMatrix(canvas);
  const currentChargeJson =
    document.getElementById("current-charge")?.textContent;
  currentCharge = currentChargeJson
    ? /** @type {ChargeAlert} */ (JSON.parse(currentChargeJson))
    : null;

  if (currentCharge) {
    setBodyClass(currentCharge);
  }

  connect();
});
