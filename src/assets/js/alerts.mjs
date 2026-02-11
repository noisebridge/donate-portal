// @ts-check

import { initConfetti, launchConfetti } from "./confetti.mjs";

/** @typedef {import("~/managers/charge-alert").ChargeAlert} ChargeAlert */
/** @typedef {import("~/money").Cents} Cents */

const confettiCanvas = /** @type {HTMLCanvasElement} */ (
  document.getElementById("confetti-canvas")
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
 * Format an ISO date string for display.
 * @param {string} isoDate
 * @returns {string}
 */
function formatDate(isoDate) {
  return new Date(isoDate).toLocaleString(undefined, {
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "numeric",
  });
}

/**
 * Push the current alert into the history list.
 * @param {ChargeAlert} alert
 */
function addToHistory(alert) {
  const item = document.createElement("div");
  item.className = "history-item";
  item.innerHTML =
    `<span class="history-product">${alert.productName}</span> ` +
    `<span class="history-amount">${formatAmount(alert.amount)}</span> ` +
    `<span class="history-date">${formatDate(alert.date)}</span>`;

  historyList.prepend(item);

  while (historyList.children.length > MAX_HISTORY) {
    historyList.removeChild(/** @type {Node} */ (historyList.lastChild));
  }
}

/** @type {ChargeAlert | null} */
let currentAlert = null;

/**
 * Update the DOM with a new charge alert.
 * @param {ChargeAlert} alert
 */
function displayAlert(alert) {
  if (currentAlert) {
    addToHistory(currentAlert);
  }
  currentAlert = alert;

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

  launchConfetti(alert.amount.cents / 100);
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

document.addEventListener("DOMContentLoaded", () => {
  initConfetti(confettiCanvas);
  connect();
});
