import type { FastifyRequest } from "fastify";
import config from "~/config";
import baseLogger from "~/lib/logger";
import {
  type CspReport,
  cspReportSchema,
  type SentryEvent,
  type SentryException,
  type SentryFrame,
  sentryEventSchema,
} from "~/types/error-reporting";

const log = baseLogger.child({ module: "error-reporting" });

/** Longest tag value sentryEventSchema accepts. */
const MAX_TAG_LENGTH = 256;
/** Longest string context value sentryEventSchema accepts. */
const MAX_CONTEXT_LENGTH = 1024;

function tagValue(value: string | number): string {
  return String(value).slice(0, MAX_TAG_LENGTH);
}

function contextValue(value: string): string {
  return value.slice(0, MAX_CONTEXT_LENGTH);
}

export function validateSentryEvent(raw: unknown): raw is SentryEvent {
  const result = sentryEventSchema.safeParse(raw);
  return result.success;
}

export function validateCspReport(raw: unknown): raw is CspReport {
  const result = cspReportSchema.safeParse(raw);
  return result.success;
}

export async function reportFrontend(event: SentryEvent): Promise<boolean> {
  if (event.platform !== "javascript") {
    log.warn({ event }, "Received non-JavaScript event from front-end");
    return false;
  }

  if (config.gitCommit) {
    event.tags = { ...event.tags, commit: config.gitCommit };
  }

  return await forward(config.frontendDSN, event);
}

export async function reportBackend(
  error: Error,
  request?: FastifyRequest,
): Promise<boolean> {
  const tags: Record<string, string> = {};
  if (config.gitCommit) {
    tags["commit"] = config.gitCommit;
  }

  const contexts: SentryEvent["contexts"] = {
    runtime: {
      name: "Bun",
      ...(typeof Bun !== "undefined" ? { version: Bun.version } : {}),
    },
  };

  if (request) {
    tags["url"] = tagValue(request.url);
    tags["method"] = request.method;
    contexts["request"] = {
      method: request.method,
      url: contextValue(request.url),
      contentType: request.headers["content-type"] ?? "unknown",
      contentLength: request.headers["content-length"] ?? "unknown",
    };
  }

  const event: SentryEvent = {
    timestamp: new Date().toISOString(),
    platform: "node",
    level: "error",
    exception: {
      values: [parseError(error)],
    },
    tags,
    contexts,
  };

  return await forward(config.backendDSN, event);
}

export async function reportCspViolation({
  "csp-report": report,
}: CspReport): Promise<boolean> {
  if (!isAppCode(report)) {
    log.debug({ report }, "Ignoring CSP violation from non-app code");
    return true;
  }

  const directive =
    report["effective-directive"] || report["violated-directive"];

  const tags: Record<string, string> = {
    "csp.directive": tagValue(directive),
  };

  if (config.gitCommit) {
    tags["commit"] = config.gitCommit;
  }

  for (const [key, value] of Object.entries(report)) {
    if (value == null) {
      continue;
    }

    tags[`csp.${key.replace(/-/g, "_")}`] = tagValue(value);
  }

  if (report["document-uri"]) {
    tags["url"] = tagValue(report["document-uri"]);
  }

  const frames: SentryFrame[] = [];
  if (report["source-file"]) {
    frames.push({
      filename: report["source-file"],
      function: "?",
      lineno: report["line-number"] ?? null,
      colno: report["column-number"] ?? null,
    });
  }

  const blockedPart = report["blocked-uri"]
    ? ` by ${report["blocked-uri"]}`
    : "";

  const documentUri = report["document-uri"]
    ? report["document-uri"].split("?")[0]
    : "Unknown";

  const event: SentryEvent = {
    timestamp: new Date().toISOString(),
    platform: "javascript",
    level: "error",
    exception: {
      values: [
        {
          type: "CSPViolation",
          value: `Blocked ${directive}${blockedPart} on ${documentUri}`,
          stacktrace: { frames },
        },
      ],
    },
    tags,
  };

  return await forward(config.frontendDSN, event);
}

function isAppCode(report: CspReport["csp-report"]): boolean {
  const blockedUri = report["blocked-uri"];
  if (blockedUri === "eval") {
    // Javascript console
    return false;
  }

  const sourceFile = report["source-file"];
  if (!sourceFile) {
    // Can't determine. Default to true to be safe.
    return true;
  }

  if (
    sourceFile.startsWith("chrome-extension") ||
    sourceFile.startsWith("safari-web-extension") ||
    sourceFile.startsWith("moz-extension") ||
    sourceFile.startsWith("user-script")
  ) {
    return false;
  }

  return true;
}

function parseError(error: Error): SentryException {
  const frames: SentryFrame[] = [];

  if (error.stack) {
    for (const line of error.stack.split("\n").slice(1)) {
      const match = /^\s*at (?:(.*?) \()?(.*?):(\d+):(\d+)\)?/.exec(line);
      if (!match) {
        continue;
      }

      frames.push({
        filename: match[2] || "",
        function: match[1] || "?",
        lineno: match[3] ? Number(match[3]) : null,
        colno: match[4] ? Number(match[4]) : null,
      });
    }
  }

  return {
    type: error.name || "Error",
    value: error.message || "No error message",
    stacktrace: { frames: frames.reverse() },
  };
}

function storeUrl(dsn: URL): URL {
  const url = new URL(`https://${dsn.host}`);
  url.pathname = `/api/${dsn.pathname.slice(1)}/store/`;
  url.searchParams.set("sentry_key", dsn.username);

  return url;
}

async function forward(dsn: URL, event: SentryEvent): Promise<boolean> {
  if (!config.production) {
    log.warn(
      { dsn },
      "Skipping error report forwarding in non-production environment",
    );
    return true;
  }

  const url = storeUrl(dsn);
  let response: Response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...event,
        event_id: crypto.randomUUID().replace(/-/g, ""),
      }),
      signal: AbortSignal.timeout(3000),
    });
  } catch (err) {
    log.error({ err, url }, "Failed to forward error report");
    return false;
  }

  if (!response.ok) {
    log.warn(
      { status: response.status, url },
      "Error reporting upstream returned non-OK status",
    );
    return false;
  }

  return true;
}
