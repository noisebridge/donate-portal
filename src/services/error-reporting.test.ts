import {
  afterAll,
  afterEach,
  beforeEach,
  describe,
  expect,
  spyOn,
  test,
} from "bun:test";
import type { FastifyRequest } from "fastify";
import config from "~/config";
import type { CspReport, SentryEvent } from "~/types/error-reporting";
import {
  reportBackend,
  reportCspViolation,
  reportFrontend,
  validateCspReport,
  validateSentryEvent,
} from "./error-reporting";

function makeSentryEvent(overrides?: Partial<SentryEvent>): SentryEvent {
  return {
    timestamp: new Date().toISOString(),
    platform: "javascript",
    level: "error",
    exception: {
      values: [
        {
          type: "Error",
          value: "test error",
          stacktrace: { frames: [] },
        },
      ],
    },
    ...overrides,
  };
}

function makeCspReport(
  overrides?: Partial<CspReport["csp-report"]>,
): CspReport {
  return {
    "csp-report": {
      "document-uri": "https://example.com/page",
      "violated-directive": "script-src",
      "effective-directive": "script-src",
      "blocked-uri": "https://evil.com/script.js",
      ...overrides,
    },
  };
}

describe("validateSentryEvent", () => {
  test("accepts a valid event", () => {
    expect(validateSentryEvent(makeSentryEvent())).toBe(true);
  });

  test("rejects event missing exception", () => {
    expect(
      validateSentryEvent({
        timestamp: new Date().toISOString(),
        platform: "javascript",
        level: "error",
      }),
    ).toBe(false);
  });

  test("rejects event with event_id set", () => {
    expect(
      validateSentryEvent({
        event_id: "00000000-0000-0000-0000-000000000000",
        timestamp: new Date().toISOString(),
        platform: "javascript",
        level: "error",
      }),
    ).toBe(false);
  });
});

describe("validateCspReport", () => {
  test("accepts a valid report", () => {
    expect(validateCspReport(makeCspReport())).toBe(true);
  });

  test("accepts a minimal report", () => {
    expect(
      validateCspReport({
        "csp-report": {
          "document-uri": "https://example.com",
          "violated-directive": "default-src",
        },
      }),
    ).toBe(true);
  });

  test("rejects report missing csp-report key", () => {
    expect(validateCspReport({ violation: {} })).toBe(false);
  });

  test("rejects report missing document-uri", () => {
    expect(
      validateCspReport({
        "csp-report": { "violated-directive": "script-src" },
      }),
    ).toBe(false);
  });
});

describe("error reporting", () => {
  // Force the production branch so `forward` actually attempts to POST, then
  // intercept the network call with a fetch spy to observe forwarding.
  const originalProduction = config.production;
  const fetchSpy = spyOn(globalThis, "fetch").mockResolvedValue(
    new Response(null, { status: 200 }),
  );

  beforeEach(() => {
    config.production = true;
    fetchSpy.mockClear();
    fetchSpy.mockResolvedValue(new Response(null, { status: 200 }));
  });

  afterEach(() => {
    config.production = originalProduction;
  });

  afterAll(() => {
    fetchSpy.mockRestore();
  });

  describe("reportFrontend", () => {
    test("forwards a valid javascript event", async () => {
      const result = await reportFrontend(makeSentryEvent());
      expect(result).toBe(true);
      expect(fetchSpy).toHaveBeenCalledTimes(1);
    });

    test("returns false for non-javascript platform without forwarding", async () => {
      const result = await reportFrontend(
        makeSentryEvent({ platform: "node" }),
      );
      expect(result).toBe(false);
      expect(fetchSpy).not.toHaveBeenCalled();
    });
  });

  describe("reportBackend", () => {
    test("forwards error report", async () => {
      const result = await reportBackend(new Error("test"));
      expect(result).toBe(true);
      expect(fetchSpy).toHaveBeenCalledTimes(1);
    });

    test("forwards error report with request context", async () => {
      const fakeRequest = {
        url: "/test",
        method: "GET",
        headers: {
          "content-type": "text/html",
          "content-length": "42",
        },
      } as unknown as FastifyRequest;
      const result = await reportBackend(new Error("test"), fakeRequest);
      expect(result).toBe(true);
      expect(fetchSpy).toHaveBeenCalledTimes(1);
    });
  });

  describe("reportCspViolation", () => {
    test("forwards CSP violation report", async () => {
      const result = await reportCspViolation(makeCspReport());
      expect(result).toBe(true);
      expect(fetchSpy).toHaveBeenCalledTimes(1);
    });

    test("forwards CSP violation with source-file info", async () => {
      const result = await reportCspViolation(
        makeCspReport({
          "source-file": "https://example.com/app.js",
          "line-number": 42,
          "column-number": 10,
        }),
      );
      expect(result).toBe(true);
      expect(fetchSpy).toHaveBeenCalledTimes(1);
    });

    test("forwards CSP violation without blocked-uri", async () => {
      const report = makeCspReport();
      delete report["csp-report"]["blocked-uri"];

      const result = await reportCspViolation(report);
      expect(result).toBe(true);
      expect(fetchSpy).toHaveBeenCalledTimes(1);
    });
  });
});
