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

/** @typedef {import("~/types/error-reporting").SentryEvent} SentryEvent */
/** @typedef {import("~/types/error-reporting").SentryFrame} SentryFrame */

/** @type {typeof import("./error-reporting.mjs")} */
let errorReporting;
/** @type {Window} */
let happyWindow;
/** @type {any} */
let sendBeacon;

beforeAll(async () => {
  // The module registers its window listeners as it is evaluated, so the
  // window it attaches to has to be the one the tests dispatch on. It is
  // therefore shared by every test in this file rather than rebuilt per test.
  happyWindow = new Window({ url: "https://donate.example.com/manage?x=1" });
  /** @type {any} */ (globalThis).window = happyWindow;
  /** @type {any} */ (globalThis).document = happyWindow.document;

  // A private copy: other test files import this module first, and its window
  // listeners are attached to whichever window existed when it was evaluated.
  // The copy binds them to the window these tests dispatch on.
  const copy = "own-window";
  errorReporting = /** @type {typeof import("./error-reporting.mjs")} */ (
    await import(`./error-reporting.mjs?${copy}`)
  );
});

afterAll(async () => {
  delete (/** @type {any} */ (globalThis).window);
  delete (/** @type {any} */ (globalThis).document);
  delete (/** @type {any} */ (globalThis).navigator);
  await happyWindow.happyDOM.close();
});

beforeEach(() => {
  sendBeacon = jest.fn(() => true);
  /** @type {any} */ (globalThis).navigator = {
    userAgent: "Mozilla/5.0 (test)",
    sendBeacon,
  };
});

/**
 * The event the module handed to `navigator.sendBeacon`.
 * @returns {SentryEvent}
 */
function reportedEvent() {
  expect(sendBeacon).toHaveBeenCalledTimes(1);
  const [path, body] = sendBeacon.mock.calls[0];
  expect(path).toBe("/error-reporting");
  return JSON.parse(body);
}

/** @returns {SentryFrame[]} */
function reportedFrames() {
  return reportedEvent().exception.values[0]?.stacktrace.frames ?? [];
}

/**
 * @param {string} name
 * @param {string} message
 * @param {string} [stack]
 * @returns {Error}
 */
function errorWith(name, message, stack) {
  const error = new Error(message);
  error.name = name;
  if (stack === undefined) {
    delete error.stack;
  } else {
    error.stack = stack;
  }
  return error;
}

/**
 * Dispatch an event on the shared window with extra properties attached.
 * @param {string} type
 * @param {Record<string, unknown>} props
 */
function fireWindowEvent(type, props) {
  const event = Object.assign(new happyWindow.Event(type), props);
  happyWindow.dispatchEvent(event);
}

describe("sendErrorReport", () => {
  it("sends the page, browser and screen context", () => {
    errorReporting.sendErrorReport(errorWith("Error", "boom"));

    const event = reportedEvent();
    expect(event.platform).toBe("javascript");
    expect(event.level).toBe("error");
    expect(event.tags?.["url"]).toBe("/manage");
    expect(event.contexts?.["browser"]?.["name"]).toBe("Mozilla/5.0 (test)");
    expect(event.contexts?.["screen"]?.["width"]).toBe(
      happyWindow.screen.width,
    );
    expect(event.contexts?.["screen"]?.["height"]).toBe(
      happyWindow.screen.height,
    );
  });

  it("keeps the error name and the first line of the message", () => {
    errorReporting.sendErrorReport(
      errorWith("TypeError", "bad thing\nmore detail"),
    );

    const exception = reportedEvent().exception.values[0];
    expect(exception?.type).toBe("TypeError");
    expect(exception?.value).toBe("bad thing");
  });

  it("falls back when the error has no name or message", () => {
    const error = errorWith("", "");

    errorReporting.sendErrorReport(error);

    const exception = reportedEvent().exception.values[0];
    expect(exception?.type).toBe("Error");
    expect(exception?.value).toBe("No error message");
  });

  it("reports no frames when the error has no stack", () => {
    errorReporting.sendErrorReport(errorWith("Error", "boom"));

    expect(reportedFrames()).toEqual([]);
  });

  it("logs when the beacon is refused", () => {
    sendBeacon.mockReturnValue(false);
    const error = jest.spyOn(console, "error").mockImplementation(() => {});

    errorReporting.sendErrorReport(errorWith("Error", "boom"));

    expect(error).toHaveBeenCalled();
    error.mockRestore();
  });
});

describe("stack trace parsing", () => {
  it("parses a Chromium stack, innermost frame last", () => {
    errorReporting.sendErrorReport(
      errorWith(
        "Error",
        "boom",
        [
          "Error: boom",
          "    at inner (https://donate.example.com/assets/js/qr.mjs:12:7)",
          "    at outer (https://donate.example.com/assets/js/qr.mjs:30:1)",
        ].join("\n"),
      ),
    );

    expect(reportedFrames()).toEqual([
      {
        filename: "https://donate.example.com/assets/js/qr.mjs",
        function: "outer",
        lineno: 30,
        colno: 1,
      },
      {
        filename: "https://donate.example.com/assets/js/qr.mjs",
        function: "inner",
        lineno: 12,
        colno: 7,
      },
    ]);
  });

  it("strips the 'address at' prefix Chromium adds for wasm frames", () => {
    errorReporting.sendErrorReport(
      errorWith(
        "Error",
        "boom",
        "    at wasmCall (address at https://donate.example.com/x.wasm:3:4)",
      ),
    );

    expect(reportedFrames()[0]?.filename).toBe(
      "https://donate.example.com/x.wasm",
    );
  });

  it("parses a Gecko stack", () => {
    errorReporting.sendErrorReport(
      errorWith(
        "Error",
        "boom",
        [
          "handler@https://donate.example.com/assets/js/alerts.mjs:400:11",
          "@https://donate.example.com/assets/js/alerts.mjs:496:3",
        ].join("\n"),
      ),
    );

    expect(reportedFrames()).toEqual([
      {
        filename: "https://donate.example.com/assets/js/alerts.mjs",
        function: "?",
        lineno: 496,
        colno: 3,
      },
      {
        filename: "https://donate.example.com/assets/js/alerts.mjs",
        function: "handler",
        lineno: 400,
        colno: 11,
      },
    ]);
  });

  it("drops lines that match neither format", () => {
    errorReporting.sendErrorReport(
      errorWith(
        "Error",
        "boom",
        [
          "Error: boom",
          "not a stack frame at all",
          "    at only (https://donate.example.com/assets/js/qr.mjs:1:1)",
        ].join("\n"),
      ),
    );

    expect(reportedFrames()).toHaveLength(1);
  });
});

describe("global handlers", () => {
  it("reports an uncaught Error", () => {
    fireWindowEvent("error", {
      error: errorWith("Error", "uncaught"),
    });

    expect(reportedEvent().exception.values[0]?.value).toBe("uncaught");
  });

  it("warns instead of reporting a non-Error thrown value", () => {
    const warn = jest.spyOn(console, "warn").mockImplementation(() => {});

    fireWindowEvent("error", { error: "a string" });

    expect(sendBeacon).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it("reports an unhandled rejection with an Error reason", () => {
    fireWindowEvent("unhandledrejection", {
      reason: errorWith("Error", "rejected"),
    });

    expect(reportedEvent().exception.values[0]?.value).toBe("rejected");
  });

  it("warns instead of reporting a non-Error rejection reason", () => {
    const warn = jest.spyOn(console, "warn").mockImplementation(() => {});

    fireWindowEvent("unhandledrejection", { reason: 42 });

    expect(sendBeacon).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });
});
