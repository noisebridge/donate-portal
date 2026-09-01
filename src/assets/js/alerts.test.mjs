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
  mock,
} from "bun:test";
import { Window } from "happy-dom";

/** @typedef {import("~/types/alerts").AlertMessage} AlertMessage */
/** @typedef {import("~/types/alerts").WebsocketMessage} WebsocketMessage */

/** Build a stub standing in for one of the canvas effect modules. */
function effectStub() {
  return {
    init: jest.fn(),
    show: jest.fn(async () => {}),
    stop: jest.fn(async () => {}),
    showStatic: jest.fn(),
    ledEffect: jest.fn(async () => {}),
  };
}

const effects = {
  confetti: effectStub(),
  dolphin: effectStub(),
  matrix: effectStub(),
  snoop: effectStub(),
  merica: effectStub(),
};
const ledHyperdrive = jest.fn(async () => {});

// The effects are canvas and WebGL animations with no place in a unit test;
// the module under test only ever calls them through these two entry points.
mock.module("./effects/index.mjs", () => ({ default: effects }));
mock.module("./effects/led_effects.mjs", () => ({ ledHyperdrive }));

/** A `WebSocket` stand-in that records what the module sends and lets tests fire events. */
class FakeSocket {
  /** @param {string} url */
  constructor(url) {
    this.url = url;
    /** @type {Record<string, ((event: any) => unknown)[]>} */
    this.listeners = {};
    /** @type {string[]} */
    this.sent = [];
    this.closed = false;
    sockets.push(this);
  }

  /**
   * @param {string} type
   * @param {(event: any) => unknown} handler
   */
  addEventListener(type, handler) {
    this.listeners[type] ??= [];
    this.listeners[type].push(handler);
  }

  /** @param {string} data */
  send(data) {
    this.sent.push(data);
  }

  close() {
    this.closed = true;
    return this.emit("close", {});
  }

  /**
   * @param {string} type
   * @param {unknown} event
   */
  async emit(type, event) {
    for (const handler of this.listeners[type] ?? []) {
      await handler(event);
    }
  }

  /** @param {WebsocketMessage} message */
  receive(message) {
    return this.emit("message", { data: JSON.stringify(message) });
  }
}

/** @type {FakeSocket[]} */
const sockets = [];
/** @type {{ fn: () => unknown, ms: number }[]} */
const intervals = [];
/** @type {{ fn: () => unknown, ms: number }[]} */
const windowTimeouts = [];
/** @type {Window} */
let happyWindow;
/** @type {Document} */
let doc;

const CURRENT_CHARGE = {
  type: "charge_alert",
  id: "ch_seed",
  date: "2026-01-01T20:00:00.000Z",
  amount: { cents: 1000 },
  productName: "Seed donation",
};

/**
 * @param {Partial<AlertMessage> & { cents?: number }} overrides
 * @returns {AlertMessage}
 */
function charge(overrides = {}) {
  const { cents, ...rest } = overrides;
  return /** @type {AlertMessage} */ ({
    type: "charge_alert",
    id: "ch_1",
    date: "2026-01-02T20:00:00.000Z",
    amount: { cents: cents ?? 500 },
    productName: "Donation",
    ...rest,
  });
}

beforeAll(async () => {
  happyWindow = new Window({ url: "https://donate.example.com/alerts" });
  doc = /** @type {Document} */ (/** @type {unknown} */ (happyWindow.document));

  doc.body.innerHTML = `
    <canvas id="effect-canvas"></canvas>
    <canvas id="banner-canvas"></canvas>
    <div class="alerts-container">
      <span id="alert-amount" data-amount="1000">$10.00</span>
      <span id="alert-product">Seed donation</span>
      <span id="alert-date">1/1/2026</span>
    </div>
    <div id="history-list"></div>
    <script id="current-charge" type="application/json">${JSON.stringify(CURRENT_CHARGE)}</script>`;

  /** @type {any} */ (globalThis).window = happyWindow;
  /** @type {any} */ (globalThis).document = doc;
  /** @type {any} */ (globalThis).location = happyWindow.location;
  /** @type {any} */ (globalThis).HTMLElement = happyWindow.HTMLElement;
  /** @type {any} */ (globalThis).WebSocket = FakeSocket;
  /** @type {any} */ (globalThis).CSS = {
    escape: (/** @type {string} */ value) => value.replace(/"/g, '\\"'),
  };

  // The queue drain and the ping watchdog are scheduled through `window`, so
  // stubbing these two lets the tests run the callbacks on demand. The matching
  // `clearInterval`/`clearTimeout` calls are made against the real globals and
  // are harmless no-ops on these fake ids.
  /** @type {any} */ (happyWindow).setInterval = (
    /** @type {() => unknown} */ fn,
    /** @type {number} */ ms,
  ) => intervals.push({ fn, ms });
  /** @type {any} */ (happyWindow).setTimeout = (
    /** @type {() => unknown} */ fn,
    /** @type {number} */ ms,
  ) => windowTimeouts.push({ fn, ms });

  await import("./alerts.mjs");
});

afterAll(async () => {
  for (const name of [
    "window",
    "document",
    "location",
    "HTMLElement",
    "WebSocket",
    "CSS",
  ]) {
    delete (/** @type {any} */ (globalThis)[name]);
  }
  await happyWindow.happyDOM.close();
});

/** @returns {FakeSocket} */
function socket() {
  return /** @type {FakeSocket} */ (sockets[sockets.length - 1]);
}

/** @returns {HTMLElement} */
function amountEl() {
  return /** @type {HTMLElement} */ (doc.getElementById("alert-amount"));
}

/** @returns {HTMLElement} */
function historyList() {
  return /** @type {HTMLElement} */ (doc.getElementById("history-list"));
}

/** Run the module's DOMContentLoaded handler and its initial connect. */
function boot() {
  return new Promise((resolve) => {
    doc.dispatchEvent(
      /** @type {Event} */ (
        /** @type {unknown} */ (new happyWindow.Event("DOMContentLoaded"))
      ),
    );
    setTimeout(resolve, 0);
  });
}

describe("splitAmount", () => {
  it("splits cents into aligned dollar and cent parts", async () => {
    const { splitAmount } = await import("./alerts.mjs");

    expect(splitAmount({ cents: 1234 })).toEqual({
      dollars: "12",
      cents: "34",
    });
    expect(splitAmount({ cents: 5 })).toEqual({ dollars: "0", cents: "05" });
  });
});

describe("start-up", () => {
  beforeAll(async () => {
    await boot();
  });

  it("sizes both canvases and hands them to the effects", () => {
    expect(effects.confetti.init).toHaveBeenCalled();
    expect(effects.matrix.init).toHaveBeenCalled();
    expect(effects.snoop.init).toHaveBeenCalled();
    expect(effects.merica.init).toHaveBeenCalled();
    expect(effects.dolphin.init).toHaveBeenCalled();

    const canvas = /** @type {HTMLCanvasElement} */ (
      doc.getElementById("effect-canvas")
    );
    expect(canvas.width).toBe(happyWindow.innerWidth);
    expect(canvas.height).toBe(happyWindow.innerHeight);
  });

  it("resizes the canvases with the window", () => {
    const canvas = /** @type {HTMLCanvasElement} */ (
      doc.getElementById("effect-canvas")
    );
    canvas.width = 1;

    happyWindow.dispatchEvent(new happyWindow.Event("resize"));

    expect(canvas.width).toBe(happyWindow.innerWidth);
  });

  it("replays the server-rendered charge as a static effect", () => {
    expect(effects.confetti.showStatic).toHaveBeenCalled();
    expect(ledHyperdrive).toHaveBeenCalled();
  });

  it("opens a websocket to the alerts endpoint", () => {
    expect(socket().url).toBe("wss://donate.example.com/alerts/ws");
  });
});

describe("the ping handshake", () => {
  beforeEach(() => {
    socket().sent.length = 0;
  });

  it("answers a ping with a pong", async () => {
    await socket().receive({ type: "ping", history: [] });

    expect(socket().sent).toEqual(['{"type":"pong"}']);
  });

  it("ignores history entries already on the page", async () => {
    await socket().receive({
      type: "ping",
      history: [/** @type {AlertMessage} */ (CURRENT_CHARGE)],
    });

    expect(historyList().children).toHaveLength(0);
  });

  it("queues history entries it has not shown yet", async () => {
    const unseen = charge({ id: "ch_history", cents: 777 });

    await socket().receive({ type: "ping", history: [unseen] });
    await drainQueue();
    await drainQueue();

    expect(amountEl().dataset["amount"]).toBe("777");
  });

  it("arms the ping watchdog, which closes a silent socket", async () => {
    await socket().emit("open", {});
    const watchdog = windowTimeouts[windowTimeouts.length - 1];
    expect(watchdog).toBeDefined();

    const before = socket();
    watchdog?.fn();
    expect(before.closed).toBe(true);
  });
});

describe("displaying an alert", () => {
  beforeEach(() => {
    historyList().innerHTML = "";
    for (const effect of Object.values(effects)) {
      effect.show.mockClear();
      effect.stop.mockClear();
    }
  });

  it("promotes the previous charge into the history list", async () => {
    await deliver(charge({ id: "ch_previous", cents: 111 }));
    historyList().innerHTML = "";

    await deliver(charge({ id: "ch_a", productName: "Coffee fund" }));

    expect(amountEl().textContent).toBe("$5.00");
    expect(doc.getElementById("alert-product")?.textContent).toBe(
      "Coffee fund",
    );
    expect(historyList().children).toHaveLength(1);
    expect(
      /** @type {HTMLElement} */ (historyList().children[0])?.dataset[
        "alertId"
      ],
    ).toBe("ch_previous");
  });

  it("badges amounts containing 69 as nice", async () => {
    await deliver(charge({ id: "ch_nice", cents: 469 }));

    expect(amountEl().querySelector(".nice-badge")?.textContent).toBe("NICE");
  });

  it("shows memberships without an amount", async () => {
    await deliver(
      /** @type {AlertMessage} */ ({
        type: "member_alert",
        id: "ch_member",
        date: "2026-01-03T20:00:00.000Z",
        productName: "Supporting member",
      }),
    );

    expect(amountEl().textContent).toBe("Membership");
    expect(amountEl().dataset["amount"]).toBe("0");
    expect(effects.confetti.show).toHaveBeenCalledWith({ cents: 10000 }, false);
  });

  it("keeps a membership in the history without an amount", async () => {
    await deliver(charge({ id: "ch_after_member" }));

    const item = /** @type {HTMLElement} */ (historyList().children[0]);
    expect(item?.dataset["amount"]).toBe("0");
    expect(item?.querySelector(".history-amount")?.textContent).toBe(
      "Membership",
    );
  });

  it("marks the biggest amount on the page with the rainbow sheen", async () => {
    await deliver(charge({ id: "ch_big", cents: 500000 }));

    expect(amountEl().classList.contains("top-amount")).toBe(true);
    expect(effects.confetti.show).toHaveBeenCalledWith({ cents: 500000 }, true);
  });

  it("ignores history rows with an unusable amount", async () => {
    const bogus = doc.createElement("div");
    bogus.dataset["amount"] = "not-a-number";
    historyList().prepend(bogus);
    const negative = doc.createElement("div");
    negative.dataset["amount"] = "-5";
    historyList().prepend(negative);

    await deliver(charge({ id: "ch_after_bogus", cents: 100 }));

    expect(bogus.classList.contains("top-amount")).toBe(false);
    expect(negative.classList.contains("top-amount")).toBe(false);
  });

  it("skips an alert that is already the header", async () => {
    const alert = charge({ id: "ch_repeat" });
    await deliver(alert);
    const before = historyList().children.length;

    await deliver(alert);

    expect(historyList().children).toHaveLength(before);
  });

  it("skips an alert already in the history list", async () => {
    await deliver(charge({ id: "ch_first" }));
    await deliver(charge({ id: "ch_second" }));
    const before = historyList().children.length;

    await deliver(charge({ id: "ch_first" }));

    expect(historyList().children).toHaveLength(before);
  });

  it("trims the history list to twenty entries", async () => {
    for (let i = 0; i < 25; i++) {
      await deliver(charge({ id: `ch_trim_${i}`, cents: 100 + i }));
    }

    expect(historyList().children.length).toBeLessThanOrEqual(20);
  });
});

describe("choosing an effect", () => {
  beforeEach(() => {
    for (const effect of Object.values(effects)) {
      effect.show.mockClear();
      effect.stop.mockClear();
    }
  });

  it("plays the default confetti effect for a plain amount", async () => {
    await deliver(charge({ id: "ch_confetti_plain", cents: 1234 }));

    expect(effects.confetti.show).toHaveBeenCalled();
  });

  it("stops the outgoing effect before starting a different one", async () => {
    await deliver(charge({ id: "ch_matrix_a", cents: 1337 }));
    await deliver(charge({ id: "ch_confetti_a", cents: 111 }));

    expect(effects.matrix.stop).toHaveBeenCalled();
  });

  it("adds the hacker body class only for hacker amounts", async () => {
    await deliver(charge({ id: "ch_hacker", cents: 31337 }));
    expect(doc.body.classList.contains("hacker")).toBe(true);

    await deliver(charge({ id: "ch_plain", cents: 222 }));
    expect(doc.body.classList.contains("hacker")).toBe(false);
  });
});

describe("the alert queue", () => {
  beforeEach(() => {
    historyList().innerHTML = "";
  });

  it("shows the first alert at once and queues the rest newest-first", async () => {
    await deliver(charge({ id: "ch_q0", cents: 111 }));
    const before = intervals.length;

    await socket().receive(charge({ id: "ch_q1", cents: 100 }));
    expect(intervals).toHaveLength(before + 1);
    expect(amountEl().dataset["amount"]).toBe("100");

    await socket().receive(
      charge({ id: "ch_q2", date: "2026-02-01T00:00:00.000Z" }),
    );
    await socket().receive(
      charge({ id: "ch_q3", date: "2026-03-01T00:00:00.000Z" }),
    );

    // ch_q3 is the newer of the two queued alerts, so it drains first.
    await drainQueue();
    expect(
      /** @type {HTMLElement} */ (historyList().children[0])?.dataset[
        "alertId"
      ],
    ).toBe("ch_q1");

    await drainQueue();
    expect(
      /** @type {HTMLElement} */ (historyList().children[0])?.dataset[
        "alertId"
      ],
    ).toBe("ch_q3");

    // The queue is empty now, so the next tick stops the drain.
    await drainQueue();
    const idle = intervals.length;
    await socket().receive(charge({ id: "ch_q4", cents: 123 }));
    expect(intervals).toHaveLength(idle + 1);
    await drainQueue();
  });

  it("shows an alert delivered twice only once", async () => {
    await deliver(charge({ id: "ch_dupe_seed", cents: 111 }));

    await socket().receive(charge({ id: "ch_dupe_head", cents: 100 }));
    await socket().receive(charge({ id: "ch_dupe" }));
    await socket().receive(charge({ id: "ch_dupe" }));

    // The first copy is skipped because its twin is still queued behind it.
    await drainQueue();
    expect(amountEl().dataset["amount"]).toBe("100");

    await drainQueue();
    expect(amountEl().dataset["amount"]).toBe("500");

    await drainQueue();
    expect(
      historyList().querySelectorAll('[data-alert-id="ch_dupe"]'),
    ).toHaveLength(0);
  });
});

describe("connection loss", () => {
  it("logs socket errors", async () => {
    const error = jest.spyOn(console, "error").mockImplementation(() => {});

    await socket().emit("error", { type: "error" });

    expect(error).toHaveBeenCalled();
    error.mockRestore();
  });

  it("reconnects with a backing-off delay", async () => {
    const before = sockets.length;
    /** @type {{ fn: () => unknown, ms: number }[]} */
    const retries = [];
    const realSetTimeout = globalThis.setTimeout;
    /** @type {any} */ (globalThis).setTimeout = (
      /** @type {() => unknown} */ fn,
      /** @type {number} */ ms,
    ) => retries.push({ fn, ms });

    await socket().close();
    globalThis.setTimeout = realSetTimeout;

    expect(retries).toHaveLength(1);
    retries[0]?.fn();
    expect(sockets).toHaveLength(before + 1);
  });
});

describe("a page that opens on a hacker amount", () => {
  it("plays that effect's LED programme instead of hyperdrive", async () => {
    for (const effect of Object.values(effects)) {
      effect.ledEffect.mockClear();
    }
    ledHyperdrive.mockClear();

    // A bigger amount elsewhere on the page means the header is not the top,
    // which is the branch that runs the effect's own LED programme.
    historyList().innerHTML = `<div data-amount="999999"></div>`;
    amountEl().dataset["amount"] = "1337";
    const script = /** @type {HTMLElement} */ (
      doc.getElementById("current-charge")
    );
    script.textContent = JSON.stringify(charge({ id: "ch_boot", cents: 1337 }));

    await boot();

    expect(effects.matrix.showStatic).toHaveBeenCalled();
    expect(effects.matrix.ledEffect).toHaveBeenCalled();
    expect(ledHyperdrive).not.toHaveBeenCalled();
  });

  it("does nothing extra when there is no charge to replay", async () => {
    const script = /** @type {HTMLElement} */ (
      doc.getElementById("current-charge")
    );
    script.remove();
    ledHyperdrive.mockClear();

    await boot();

    expect(ledHyperdrive).not.toHaveBeenCalled();
  });
});

/**
 * Fire the queue-drain interval the module is currently running. The callback
 * is a no-op once the module has cleared the interval, so it is safe to call
 * more often than there are queued alerts.
 */
function drainQueue() {
  return intervals[intervals.length - 1]?.fn();
}

/**
 * Push an alert down the socket and let the queue drain completely, leaving
 * the module idle again.
 * @param {AlertMessage} alert
 */
async function deliver(alert) {
  await socket().receive(alert);
  await drainQueue();
  await drainQueue();
}
