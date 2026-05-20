import type { FastifyRequest } from "fastify";
import config from "~/config";
import { baseLogger } from "~/logger";
import {
  type CspReport,
  cspReportSchema,
  type SentryEvent,
  type SentryException,
  type SentryFrame,
  sentryEventSchema,
} from "~/types/error-reporting";

export function validateSentryEvent(raw: unknown): raw is SentryEvent {
  const result = sentryEventSchema.safeParse(raw);
  return result.success;
}

export function validateCspReport(raw: unknown): raw is CspReport {
  const result = cspReportSchema.safeParse(raw);
  return result.success;
}

class ErrorReportingService {
  static readonly log = baseLogger.child({ class: "ErrorReportingService" });

  async reportFrontend(event: SentryEvent): Promise<boolean> {
    if (event.platform !== "javascript") {
      ErrorReportingService.log.warn(
        { event },
        "Received non-JavaScript event from front-end",
      );
      return false;
    }

    if (config.gitCommit) {
      event.tags = { ...event.tags, commit: config.gitCommit };
    }

    return await this.forward(config.frontendDSN, event);
  }

  async reportBackend(
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
      tags["url"] = request.url;
      tags["method"] = request.method;
      contexts["request"] = {
        method: request.method,
        url: request.url,
        contentType: request.headers["content-type"] ?? "unknown",
        contentLength: request.headers["content-length"] ?? "unknown",
      };
    }

    const event: SentryEvent = {
      timestamp: new Date().toISOString(),
      platform: "node",
      level: "error",
      exception: {
        values: [this.parseError(error)],
      },
      tags,
      contexts,
    };

    return await this.forward(config.backendDSN, event);
  }

  async reportCspViolation({
    "csp-report": report,
  }: CspReport): Promise<boolean> {
    const directive =
      report["effective-directive"] || report["violated-directive"];

    const tags: Record<string, string> = {
      "csp.directive": directive,
    };
    if (config.gitCommit) {
      tags["commit"] = config.gitCommit;
    }
    if (report["blocked-uri"]) {
      tags["csp.blocked_uri"] = report["blocked-uri"];
    }
    if (report["document-uri"]) {
      tags["csp.document_uri"] = report["document-uri"];
      tags["url"] = report["document-uri"];
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

    const event: SentryEvent = {
      timestamp: new Date().toISOString(),
      platform: "javascript",
      level: "error",
      exception: {
        values: [
          {
            type: "CSPViolation",
            value: `Blocked ${directive}${blockedPart} on ${report["document-uri"]}`,
            stacktrace: { frames },
          },
        ],
      },
      tags,
    };

    return await this.forward(config.frontendDSN, event);
  }

  private parseError(error: Error): SentryException {
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

  private storeUrl(dsn: URL): string {
    const url = new URL(`https://${dsn.host}`);
    url.pathname = `/api/${dsn.pathname.slice(1)}/store/`;
    url.searchParams.set("sentry_key", dsn.username);

    return url.toString();
  }

  async forward(dsn: URL, event: SentryEvent): Promise<boolean> {
    if (!config.production) {
      ErrorReportingService.log.warn(
        { dsn },
        "Skipping error report forwarding in non-production environment",
      );
      return true;
    }

    const url = this.storeUrl(dsn);
    let response: Response;
    try {
      response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...event,
          event_id: crypto.randomUUID().replace(/-/g, ""),
        }),
      });
    } catch (err) {
      ErrorReportingService.log.error(
        { err, url },
        "Failed to forward error report",
      );
      return false;
    }

    if (!response.ok) {
      ErrorReportingService.log.warn(
        { status: response.status, url },
        "Error reporting upstream returned non-OK status",
      );
      return false;
    }

    return true;
  }
}

const errorReportingService = new ErrorReportingService();
export default errorReportingService;
