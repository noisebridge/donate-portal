// @ts-check

import effects from "./effects/index.mjs";
import { ledHyperdrive } from "./effects/led_effects.mjs";
import { formatAmount } from "./util/money-forms.mjs";

/** @typedef {import("~/types/alerts").AlertMessage} AlertMessage */
/** @typedef {import("~/types/alerts").ChargeAlertMessage} ChargeAlertMessage */
/** @typedef {import("~/types/alerts").MemberAlertMessage} MemberAlertMessage */
/** @typedef {import("~/types/alerts").PongMessage} PongMessage */
/** @typedef {import("~/types/alerts").WebsocketMessage} WebsocketMessage */
/** @typedef {import("~/types/cents").Cents} Cents */
/** @typedef {import("~/lib/paths").Paths} Paths */

/** @satisfies {Paths['alertsWs']} */
const WS_PATH = "/alerts/ws";

const effectCanvas = /** @type {HTMLCanvasElement} */ (
  document.getElementById("effect-canvas")
);
const bannerCanvas = /** @type {HTMLCanvasElement} */ (
  document.getElementById("banner-canvas")
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

const MAX_RECONNECT_DELAY = 30000;
const DEFAULT_RECONNECT_DELAY = 1000;
const PING_TIMEOUT_MS = 70000;
const MAX_HISTORY = 20;
const HACKER_AMOUNTS = [1337, 13370, 31337, 133700, 133769, 313370];
const SNOOP_AMOUNTS = [420, 42000, 42069];
const MERICA_AMOUNTS = [1776, 17760, 177600, 177669];
const DOLPHIN_AMOUNTS = [4200];

let reconnectDelay = DEFAULT_RECONNECT_DELAY;

const ALERT_INTERVAL_MS = 15000;
/** @type {number | null} */
let queueDrainInterval = null;

// Sorted newest to oldest.
/** @type {AlertMessage[]} */
const alertQueue = [];

/** @type {keyof typeof effects | null} */
let activeEffect = null;

/**
 * @param {AlertMessage} alert
 * @returns {keyof typeof effects}
 */
function effectForAlert(alert) {
  if (alert.type === "member_alert") {
    return "confetti";
  }

  if (MERICA_AMOUNTS.includes(alert.amount.cents)) {
    return "merica";
  } else if (DOLPHIN_AMOUNTS.includes(alert.amount.cents)) {
    return "dolphin";
  } else if (SNOOP_AMOUNTS.includes(alert.amount.cents)) {
    return "snoop";
  } else if (HACKER_AMOUNTS.includes(alert.amount.cents)) {
    return "matrix";
  } else {
    return "confetti";
  }
}

/**
 * Switch to a new effect, stopping the previous one unless it's the same.
 * @param {keyof typeof effects} name
 * @param {Cents} amount
 * @param {boolean} showHyperdrive
 */
async function switchEffect(name, amount, showHyperdrive) {
  if (activeEffect && activeEffect !== name) {
    await effects[activeEffect].stop();
  }

  await effects[name].show(amount, showHyperdrive);
  activeEffect = name;
}

/**
 * Add an alert to the queue in a time-sorted position.
 * @param {AlertMessage} alert
 */
function sortedQueueInsert(alert) {
  const alertTime = new Date(alert.date).getTime();

  let insertIndex = alertQueue.length;
  for (const [index, queuedAlert] of alertQueue.entries()) {
    const queuedAlertTime = new Date(queuedAlert.date).getTime();
    if (queuedAlertTime > alertTime) {
      continue;
    }

    insertIndex = index;
    break;
  }

  alertQueue.splice(insertIndex, 0, alert);
}

/**
 * Enqueue an alert and start draining if not already in progress.
 * @param {AlertMessage} alert
 */
async function enqueueAlert(alert) {
  if (queueDrainInterval) {
    sortedQueueInsert(alert);
    return;
  }

  queueDrainInterval = window.setInterval(async () => {
    if (!queueDrainInterval) {
      return;
    }

    const alert = alertQueue.shift();
    if (!alert) {
      clearInterval(queueDrainInterval);
      queueDrainInterval = null;
      return;
    }

    await displayAlert(alert);
  }, ALERT_INTERVAL_MS);

  await displayAlert(alert);
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
  return formatAmount(amount).includes("69");
}

/**
 * Split cents into its dollar and cent parts for aligned display.
 * @param {Cents} amount
 * @returns {{ dollars: string, cents: string }}
 */
export function splitAmount(amount) {
  const parts = (amount.cents / 100).toFixed(2).split(".");
  return {
    dollars: /** @type {string} */ (parts[0]),
    cents: /** @type {string} */ (parts[1]),
  };
}

/**
 * Build an amount element with aligned dollar/cent spans.
 * @param {Cents} amount
 * @returns {HTMLSpanElement}
 */
function buildAmountAligned(amount) {
  const { dollars, cents } = splitAmount(amount);

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
 * Check whether an alert has already been processed.
 * @param {AlertMessage} alert
 * @returns {boolean}
 */
function seenAlert(alert) {
  if (currentCharge?.id === alert.id) {
    // This is the header alert
    return true;
  }

  const historyElem = historyList.querySelector(
    `[data-alert-id="${CSS.escape(alert.id)}"]`,
  );
  if (historyElem !== null) {
    // This alert is in the history list
    return true;
  }

  if (alertQueue.find((queuedAlert) => queuedAlert.id === alert.id)) {
    // This alert is queue'd up
    return true;
  }

  return false;
}

/**
 * Apply the rainbow sheen class to the largest donation amount (latest wins).
 * @returns {boolean} Whether the highest amount belongs to the most recent alert.
 */
function applyRainbowSheen() {
  let topAmount = 0;
  /** @type {HTMLElement | null} */
  let topElement = null;

  for (const element of Array.from(
    document.querySelectorAll("[data-amount]"),
  )) {
    if (!(element instanceof HTMLElement)) {
      continue;
    }

    element.classList.remove("top-amount");

    const amount = Number(element.dataset["amount"]);
    if (Number.isNaN(amount) || amount < 0) {
      continue;
    }

    if (amount > topAmount) {
      topAmount = amount;
      topElement = element;
    }
  }

  if (topElement) {
    topElement.classList.add("top-amount");
  }

  return topElement === amountEl;
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

/**
 * Update text at the top of the page for the latest alert.
 * @param {AlertMessage} alert
 */
function updateHeader(alert) {
  if (alert.type === "member_alert") {
    amountEl.textContent = "Membership";
    amountEl.dataset["amount"] = "0";
  } else {
    amountEl.textContent = formatAmount(alert.amount);
    if (isNice(alert.amount)) {
      amountEl.append(niceBadge());
    }
    amountEl.dataset["amount"] = alert.amount.cents.toString();
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
}

/** @type {AlertMessage | null} */
let currentCharge = null;

/**
 * Update the DOM with a new alert.
 * @param {AlertMessage} alert
 */
async function displayAlert(alert) {
  if (seenAlert(alert)) {
    return;
  }

  if (currentCharge) {
    addToHistory(currentCharge);
  }
  currentCharge = alert;

  setBodyClass(alert);
  updateHeader(alert);
  const newIsTop = applyRainbowSheen();

  const effect = effectForAlert(alert);
  const amount =
    alert.type === "member_alert" ? { cents: 10000 } : alert.amount;
  const hyperdrive = alert.type === "member_alert" ? false : newIsTop;
  await switchEffect(effect, amount, hyperdrive);
}

function connect() {
  const protocol = location.protocol === "https:" ? "wss:" : "ws:";
  const url = `${protocol}//${location.host}${WS_PATH}`;

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
  ws.addEventListener("message", async (event) => {
    const message = /** @type {WebsocketMessage} */ (JSON.parse(event.data));
    if (message.type === "ping") {
      resetPingTimeout();
      ws.send(
        JSON.stringify(/** @satisfies {PongMessage} */ ({ type: "pong" })),
      );

      for (const alert of message.history.reverse()) {
        if (seenAlert(alert)) {
          continue;
        }

        await enqueueAlert(alert);
      }
      return;
    }

    await enqueueAlert(message);
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

document.addEventListener("DOMContentLoaded", async () => {
  initCanvas(effectCanvas);
  effects.confetti.init(effectCanvas);
  effects.matrix.init(effectCanvas);
  effects.snoop.init(effectCanvas);

  initCanvas(bannerCanvas);
  effects.merica.init(bannerCanvas);
  effects.dolphin.init(bannerCanvas);

  const currentChargeJson =
    document.getElementById("current-charge")?.textContent;
  currentCharge = currentChargeJson
    ? /** @type {AlertMessage} */ (JSON.parse(currentChargeJson))
    : null;

  const newIsTop = applyRainbowSheen();
  if (currentCharge) {
    setBodyClass(currentCharge);
    activeEffect = effectForAlert(currentCharge);
    effects[activeEffect].showStatic?.();

    if (newIsTop) {
      await ledHyperdrive();
    } else if (activeEffect !== "confetti") {
      await effects[activeEffect].ledEffect();
    }
  }

  connect();
});
