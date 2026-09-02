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
import {
  type CspReport,
  type SentryEvent,
  sentryEventSchema,
} from "~/types/error-reporting";
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

    test("tags the event with the git commit when one is configured", async () => {
      const originalCommit = config.gitCommit;
      config.gitCommit = "abc1234";

      try {
        await reportFrontend(makeSentryEvent());
      } finally {
        config.gitCommit = originalCommit;
      }

      const body = JSON.parse(String(fetchSpy.mock.calls[0]?.[1]?.body));
      expect(body.tags.commit).toBe("abc1234");
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

    test("tags the report with the git commit when one is configured", async () => {
      const originalCommit = config.gitCommit;
      config.gitCommit = "abc1234";

      try {
        await reportBackend(new Error("test"));
      } finally {
        config.gitCommit = originalCommit;
      }

      const body = JSON.parse(String(fetchSpy.mock.calls[0]?.[1]?.body));
      expect(body.tags.commit).toBe("abc1234");
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

    test("clips a long request URL in both tag and context", async () => {
      const fakeRequest = {
        url: `/${"a".repeat(2048)}`,
        method: "GET",
        headers: {},
      } as unknown as FastifyRequest;

      await reportBackend(new Error("test"), fakeRequest);

      const body = JSON.parse(String(fetchSpy.mock.calls[0]?.[1]?.body));
      expect(body.tags.url).toHaveLength(256);
      expect(body.contexts.request.url).toHaveLength(1024);
      expect(sentryEventSchema.safeParse(body).success).toBe(true);
    });
  });

  describe("reportCspViolation", () => {
    test("forwards CSP violation report", async () => {
      const result = await reportCspViolation(makeCspReport());
      expect(result).toBe(true);
      expect(fetchSpy).toHaveBeenCalledTimes(1);
    });

    test("clips long tag values so the event stays schema-valid", async () => {
      await reportCspViolation(
        makeCspReport({ "original-policy": "x".repeat(4096) }),
      );

      const body = JSON.parse(String(fetchSpy.mock.calls[0]?.[1]?.body));
      expect(sentryEventSchema.safeParse(body).success).toBe(true);
    });

    test("ignores violations raised by browser extensions", async () => {
      const result = await reportCspViolation(
        makeCspReport({ "source-file": "chrome-extension://abcdef/inject.js" }),
      );

      expect(result).toBe(true);
      expect(fetchSpy).not.toHaveBeenCalled();
    });

    test("ignores violations raised by eval in the console", async () => {
      const result = await reportCspViolation(
        makeCspReport({ "blocked-uri": "eval" }),
      );

      expect(result).toBe(true);
      expect(fetchSpy).not.toHaveBeenCalled();
    });
  });

  describe("forward", () => {
    test("returns false when the upstream request throws", async () => {
      fetchSpy.mockRejectedValue(new Error("network down"));

      expect(await reportBackend(new Error("test"))).toBe(false);
    });

    test("returns false when the upstream returns a non-OK status", async () => {
      fetchSpy.mockResolvedValue(new Response(null, { status: 500 }));

      expect(await reportBackend(new Error("test"))).toBe(false);
    });

    test("skips forwarding outside production", async () => {
      config.production = false;

      expect(await reportBackend(new Error("test"))).toBe(true);
      expect(fetchSpy).not.toHaveBeenCalled();
    });
  });
});
