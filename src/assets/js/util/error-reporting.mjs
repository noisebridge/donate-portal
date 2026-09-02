// @ts-check

/**
 * @typedef {import("~/types/error-reporting").SentryException} SentryException
 * @typedef {import("~/types/error-reporting").SentryFrame} SentryFrame
 * @typedef {import("~/types/error-reporting").SentryEvent} SentryEvent
 * @typedef {import("~/lib/paths").Paths} Paths
 */

/** @satisfies {Paths['errorReporting']} */
const ERROR_REPORTING_PATH = "/error-reporting";

const CHROME_RE =
  /^\s*at (?:(.*?) ?\()?((?:file|https?|blob|chrome-extension|address|native|eval|webpack|<anonymous>|[-a-z]+:|.*bundle|\/).*?)(?::(\d+))?(?::(\d+))?\)?\s*$/i;
const GECKO_RE =
  /^\s*(.*?)(?:\((.*?)\))?(?:^|@)?((?:file|https?|blob|chrome|webpack|resource|moz-extension).*?:\/.*?|\[native code\]|[^@]*(?:bundle|\d+\.js))(?::(\d+))?(?::(\d+))?\s*$/i;

// Limits from sentryEventSchema in ~/types/error-reporting. The server
// answers 400 and drops the whole report if anything exceeds them.
const MAX_TYPE_LENGTH = 256;
const MAX_VALUE_LENGTH = 2048;
const MAX_FRAME_STRING_LENGTH = 1024;
const MAX_FRAMES = 100;

/**
 * @param {string} value
 * @param {number} max
 * @returns {string}
 */
function truncate(value, max) {
  return value.length > max ? value.slice(0, max) : value;
}

/**
 * Parse one line of a stacktrace.
 * @param {string} line
 * @returns {SentryFrame | null}
 */
function parseLine(line) {
  const chrome = CHROME_RE.exec(line);
  if (chrome) {
    return {
      filename: truncate(
        chrome[2] && chrome[2].indexOf("address at ") === 0
          ? chrome[2].slice("address at ".length)
          : chrome[2] || "",
        MAX_FRAME_STRING_LENGTH,
      ),
      function: truncate(chrome[1] || "?", MAX_FRAME_STRING_LENGTH),
      lineno: chrome[3] ? Number(chrome[3]) : null,
      colno: chrome[4] ? Number(chrome[4]) : null,
    };
  }

  const gecko = GECKO_RE.exec(line);
  if (gecko) {
    return {
      filename: truncate(gecko[3] || "", MAX_FRAME_STRING_LENGTH),
      function: truncate(gecko[1] || "?", MAX_FRAME_STRING_LENGTH),
      lineno: gecko[4] ? Number(gecko[4]) : null,
      colno: gecko[5] ? Number(gecko[5]) : null,
    };
  }

  return null;
}

/**
 * Parse an `Error`'s stack trace into the Sentry exception format.
 * Supports Chromium-based browsers (Chrome, Edge, Brave, Opera) and Gecko (Firefox).
 *
 * @param {Error} error
 * @returns {SentryException}
 */
function parseStackTrace(error) {
  /** @type {SentryFrame[]} */
  const frames = [];

  const stackLines = error.stack?.split("\n") ?? [];
  for (const line of stackLines) {
    const frame = parseLine(line);
    if (!frame) {
      continue;
    }

    if (!frame.function && frame.lineno) {
      frame.function = "?";
    }

    frames.push(frame);
  }

  return {
    type: truncate(error.name || "Error", MAX_TYPE_LENGTH),
    value: truncate(
      error.message.split("\n")[0] || "No error message",
      MAX_VALUE_LENGTH,
    ),
    // Innermost frames go last, so keep the tail when there are too many.
    stacktrace: { frames: frames.reverse().slice(-MAX_FRAMES) },
  };
}

/**
 * Report an `Error` to the server-side error reporting endpoint.
 * @param {Error} error
 */
export function sendErrorReport(error) {
  /** @type {SentryEvent} */
  const event = {
    timestamp: new Date().toISOString(),
    platform: "javascript",
    level: "error",
    exception: { values: [parseStackTrace(error)] },
    tags: {
      url: window.location.pathname,
    },
    contexts: {
      browser: {
        name: navigator.userAgent,
      },
      screen: {
        width: window.screen.width,
        height: window.screen.height,
      },
    },
  };

  const body = JSON.stringify(event);

  const success = navigator.sendBeacon(ERROR_REPORTING_PATH, body);
  if (!success) {
    console.error("Failed to log error to server");
  }
}

let initialized = false;

function initErrorReporting() {
  if (initialized) {
    return;
  }

  window.addEventListener("error", (event) => {
    if (event.error instanceof Error) {
      sendErrorReport(event.error);
    } else {
      console.warn("Can't log event:", event);
    }
  });

  window.addEventListener("unhandledrejection", (event) => {
    if (event.reason instanceof Error) {
      sendErrorReport(event.reason);
    } else {
      console.warn("Can't log event:", event);
    }
  });

  initialized = true;
}

initErrorReporting();
