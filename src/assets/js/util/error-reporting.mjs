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

/**
 * Parse one line of a stacktrace.
 * @param {string} line
 * @returns {SentryFrame | null}
 */
function parseLine(line) {
  const chrome = CHROME_RE.exec(line);
  if (chrome) {
    return {
      filename:
        chrome[2] && chrome[2].indexOf("address at ") === 0
          ? chrome[2].slice("address at ".length)
          : chrome[2] || "",
      function: chrome[1] || "?",
      lineno: chrome[3] ? Number(chrome[3]) : null,
      colno: chrome[4] ? Number(chrome[4]) : null,
    };
  }

  const gecko = GECKO_RE.exec(line);
  if (gecko) {
    return {
      filename: gecko[3] || "",
      function: gecko[1] || "?",
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
    type: error.name || "Error",
    value: error.message.split("\n")[0] || "No error message",
    stacktrace: { frames: frames.reverse() },
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
