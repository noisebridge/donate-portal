// @ts-check

import {
  initConfetti,
  launchConfetti,
  stopConfetti,
} from "./util/confetti.mjs";
import { ledMatrix, ledMerica, ledSnoop } from "./util/led_effects.mjs";
import { initMatrix, showMatrix, stopMatrix } from "./util/matrix.mjs";
import {
  initMerica,
  showMerica,
  showMericaFlag,
  stopMerica,
} from "./util/merica.mjs";
import {
  initSnoop,
  showSnoop,
  showSnoopLeaves,
  stopSnoop,
} from "./util/snoop.mjs";

/** @typedef {import("~/types/alerts").ChargeAlertMessage} ChargeAlertMessage */
/** @typedef {import("~/types/alerts").MemberAlertMessage} MemberAlertMessage */
/** @typedef {import("~/types/alerts").AlertMessage} AlertMessage */
/** @typedef {import("~/types/alerts").WebsocketMessage} WebsocketMessage */
/** @typedef {import("~/types/cents").Cents} Cents */

const effectCanvas = /** @type {HTMLCanvasElement} */ (
  document.getElementById("effect-canvas")
);
const flagCanvas = /** @type {HTMLCanvasElement} */ (
  document.getElementById("flag-canvas")
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
const PING_TIMEOUT_MS = 70000;
const MAX_HISTORY = 20;
const HACKER_AMOUNTS = [1337, 13370, 133700, 133769];
const SNOOP_AMOUNTS = [420, 42000, 42069];
const MERICA_AMOUNTS = [1776, 17760, 177600, 177669];

let reconnectDelay = DEFAULT_RECONNECT_DELAY;

const ALERT_INTERVAL_MS = 15000;
/** @type {number | null} */
let queueDrainInterval = null;

/** @type {AlertMessage[]} */
const alertQueue = [];

/**
 * Enqueue an alert and start draining if not already in progress.
 * @param {AlertMessage} alert
 */
function enqueueAlert(alert) {
  alertQueue.push(alert);

  if (queueDrainInterval) {
    return;
  }

  displayAlert(alert);

  queueDrainInterval = window.setInterval(() => {
    if (!queueDrainInterval) {
      return;
    }

    alertQueue.shift();
    if (alertQueue.length === 0) {
      clearInterval(queueDrainInterval);
      queueDrainInterval = null;
      return;
    }

    displayAlert(/** @type {AlertMessage} */ (alertQueue[0]));
  }, ALERT_INTERVAL_MS);
}

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
 * Check whether a cent amount contains 69 (not across the decimal).
 * @param {Cents} amount
 * @returns {boolean}
 */
function isNice(amount) {
  return String(amount.cents).includes("69");
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

  const centsSpan = span("history-amount-cents", cents);
  if (isNice(amount)) {
    centsSpan.append(niceBadge());
  }

  const wrapper = document.createElement("span");
  wrapper.className = "history-amount";
  wrapper.append(span("history-amount-dollars", `$${dollars}.`), centsSpan);

  return wrapper;
}

/**
 * Create a "NICE" badge element.
 * @returns {HTMLSpanElement}
 */
function niceBadge() {
  const el = document.createElement("span");
  el.className = "nice-badge";
  el.textContent = "NICE";
  return el;
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
 * Scan history items and apply the rainbow class to the one with the highest amount,
 * considering both the current charge and all history items.
 */
function updateTopAmount() {
  const currentCents =
    currentCharge?.type === "charge_alert" ? currentCharge.amount.cents : 0;
  const latestAmount = document.getElementById("alert-amount");
  let topItem = /** @type {Element | null} */ (currentCharge && latestAmount);
  let topCents = currentCents;

  const items = /** @type {HTMLElement[]} */ (Array.from(historyList.children));
  for (const item of items) {
    const cents = Number(item.dataset["amount"]);
    if (cents > topCents) {
      topCents = cents;
      topItem = item;
    }
  }

  latestAmount?.classList.toggle("top-amount", latestAmount === topItem);

  for (const item of items) {
    item.classList.toggle("top-amount", item === topItem);
  }
}

/**
 * Push the current alert into the history list.
 * @param {AlertMessage} alert
 */
function addToHistory(alert) {
  const item = document.createElement("div");
  item.className = "history-item";
  item.dataset["alertId"] = alert.id;

  if (alert.type === "member_alert") {
    item.dataset["amount"] = "0";
    item.append(
      span("history-product", alert.productName),
      span("history-amount", "Membership"),
      span("history-date", formatDate(alert.date)),
    );
  } else {
    item.dataset["amount"] = String(alert.amount.cents);
    item.append(
      span("history-product", alert.productName),
      buildAmountAligned(alert.amount),
      span("history-date", formatDate(alert.date)),
    );
  }

  historyList.prepend(item);

  while (historyList.children.length > MAX_HISTORY) {
    historyList.removeChild(/** @type {Node} */ (historyList.lastChild));
  }
}

/**
 * @param {AlertMessage} alert
 */
function setBodyClass(alert) {
  document.body.classList.toggle(
    "hacker",
    alert.type === "charge_alert" &&
      HACKER_AMOUNTS.includes(alert.amount.cents),
  );
}

/** @type {AlertMessage | null} */
let currentCharge = null;

/**
 * Update the DOM with a new alert.
 * @param {AlertMessage} alert
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
  updateTopAmount();

  if (alert.type === "member_alert") {
    amountEl.textContent = "Membership";
  } else {
    amountEl.textContent = formatAmount(alert.amount);
    if (isNice(alert.amount)) {
      amountEl.append(niceBadge());
    }
  }
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

  if (alert.type === "member_alert") {
    stopMatrix();
    stopSnoop();
    stopMerica();
    launchConfetti({ cents: 10000 });
  } else if (MERICA_AMOUNTS.includes(alert.amount.cents)) {
    stopConfetti();
    stopMatrix();
    stopSnoop();
    showMerica(alert.amount);
  } else if (SNOOP_AMOUNTS.includes(alert.amount.cents)) {
    stopConfetti();
    stopMatrix();
    stopMerica();
    showSnoop();
  } else if (HACKER_AMOUNTS.includes(alert.amount.cents)) {
    stopConfetti();
    stopSnoop();
    stopMerica();
    showMatrix();
  } else {
    stopMatrix();
    stopSnoop();
    stopMerica();
    launchConfetti(alert.amount);
  }
}

function connect() {
  const protocol = location.protocol === "https:" ? "wss:" : "ws:";
  const url = `${protocol}//${location.host}${wsPath}`;

  const ws = new WebSocket(url);
  /** @type {number | null} */
  let pingTimeout = null;

  function resetPingTimeout() {
    if (pingTimeout) {
      clearTimeout(pingTimeout);
    }
    pingTimeout = window.setTimeout(() => {
      ws.close();
    }, PING_TIMEOUT_MS);
  }

  ws.addEventListener("open", () => {
    reconnectDelay = DEFAULT_RECONNECT_DELAY;
    resetPingTimeout();
  });
  ws.addEventListener("message", (event) => {
    const message = /** @type {WebsocketMessage} */ (JSON.parse(event.data));
    if (message.type === "ping") {
      resetPingTimeout();
      ws.send(JSON.stringify({ type: "pong" }));
      return;
    }

    enqueueAlert(message);
  });
  ws.addEventListener("error", (event) => {
    console.error("WebSocket error:", event);
  });
  ws.addEventListener("close", () => {
    if (pingTimeout) {
      clearTimeout(pingTimeout);
    }

    setTimeout(() => {
      reconnectDelay = Math.min(reconnectDelay * 2, MAX_RECONNECT_DELAY);
      connect();
    }, reconnectDelay);
  });
}

/**
 * Initialize a full-screen canvas element with auto-resize.
 * @param {HTMLCanvasElement} canvasEl
 */
function initCanvas(canvasEl) {
  function resize() {
    canvasEl.width = window.innerWidth;
    canvasEl.height = window.innerHeight;
  }

  window.addEventListener("resize", resize);
  resize();
}

document.addEventListener("DOMContentLoaded", () => {
  initCanvas(effectCanvas);
  initConfetti(effectCanvas);
  initMatrix(effectCanvas);
  initSnoop(effectCanvas);

  initCanvas(flagCanvas);
  initMerica(flagCanvas);

  const currentChargeJson =
    document.getElementById("current-charge")?.textContent;
  currentCharge = currentChargeJson
    ? /** @type {AlertMessage} */ (JSON.parse(currentChargeJson))
    : null;

  if (currentCharge) {
    setBodyClass(currentCharge);
    if (
      currentCharge.type === "charge_alert" &&
      SNOOP_AMOUNTS.includes(currentCharge.amount.cents)
    ) {
      showSnoopLeaves();
      ledSnoop();
    } else if (
      currentCharge.type === "charge_alert" &&
      MERICA_AMOUNTS.includes(currentCharge.amount.cents)
    ) {
      showMericaFlag();
      ledMerica();
    } else if (
      currentCharge.type === "charge_alert" &&
      HACKER_AMOUNTS.includes(currentCharge.amount.cents)
    ) {
      ledMatrix();
    }
  }

  updateTopAmount();
  connect();
});
