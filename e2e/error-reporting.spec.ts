import { expect, test } from "./fixtures";

test.describe("Error Reporting Endpoint", () => {
  const validEvent = {
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
  };

  test("accepts valid sentry event", async ({ request }) => {
    const response = await request.post("/error-reporting", {
      headers: { "Content-Type": "text/plain;charset=UTF-8" },
      data: JSON.stringify(validEvent),
    });
    expect(response.status()).toBe(204);
  });

  test("rejects wrong content-type", async ({ request }) => {
    const response = await request.post("/error-reporting", {
      headers: { "Content-Type": "application/json" },
      data: JSON.stringify(validEvent),
    });
    expect(response.status()).toBe(415);
  });

  test("rejects non-JSON body", async ({ request }) => {
    const response = await request.post("/error-reporting", {
      headers: { "Content-Type": "text/plain;charset=UTF-8" },
      data: "not json",
    });
    expect(response.status()).toBe(400);
  });

  test("rejects invalid sentry event", async ({ request }) => {
    const response = await request.post("/error-reporting", {
      headers: { "Content-Type": "text/plain;charset=UTF-8" },
      data: JSON.stringify({ bad: "event" }),
    });
    expect(response.status()).toBe(400);
  });
});

test.describe("CSP Reporting Endpoint", () => {
  const validReport = {
    "csp-report": {
      "document-uri": "https://example.com/page",
      "violated-directive": "script-src",
      "effective-directive": "script-src",
      "blocked-uri": "https://evil.com/script.js",
    },
  };

  test("accepts valid CSP report with application/csp-report", async ({
    request,
  }) => {
    const response = await request.post("/csp-report", {
      headers: { "Content-Type": "application/csp-report" },
      data: JSON.stringify(validReport),
    });
    expect(response.status()).toBe(204);
  });

  test("accepts valid CSP report with application/json", async ({
    request,
  }) => {
    const response = await request.post("/csp-report", {
      headers: { "Content-Type": "application/json" },
      data: JSON.stringify(validReport),
    });
    expect(response.status()).toBe(204);
  });

  test("rejects wrong content-type", async ({ request }) => {
    const response = await request.post("/csp-report", {
      headers: { "Content-Type": "text/plain" },
      data: JSON.stringify(validReport),
    });
    expect(response.status()).toBe(415);
  });

  test("rejects invalid CSP report", async ({ request }) => {
    const response = await request.post("/csp-report", {
      headers: { "Content-Type": "application/json" },
      data: JSON.stringify({ bad: "report" }),
    });
    expect(response.status()).toBe(400);
  });

  test("inline script injection triggers a CSP violation report", async ({
    page,
  }) => {
    await page.goto("/");

    const reportPromise = page.waitForRequest(
      (req) => req.url().includes("/csp-report") && req.method() === "POST",
      { timeout: 5000 },
    );

    await page.evaluate(`
      const script = document.createElement("script");
      script.textContent = "void 0";
      document.head.appendChild(script);
    `);

    const reportRequest = await reportPromise;
    const body = reportRequest.postDataJSON();
    expect(body["csp-report"]).toBeDefined();
    expect(body["csp-report"]["violated-directive"]).toContain("script-src");
  });
});
