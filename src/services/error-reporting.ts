import type { FastifyRequest } from "fastify";
import config from "~/config";
import { baseLogger } from "~/logger";

interface SentryFrame {
  filename: string;
  function: string;
  lineno: number | null;
  colno: number | null;
}

interface SentryException {
  type: string;
  value: string;
  stacktrace: { frames: SentryFrame[] };
}

export interface SentryEvent {
  event_id: string;
  timestamp: string;
  platform: string;
  level: string;
  exception: { values: SentryException[] };
  tags?: Record<string, string>;
  contexts?: Record<string, Record<string, unknown>>;
}

class ErrorReportingService {
  static readonly log = baseLogger.child({ class: "ErrorReportingService" });

  async reportFrontend(event: SentryEvent): Promise<boolean> {
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

    const contexts: Record<string, Record<string, unknown>> = {
      runtime: {
        name: "Bun",
        version: typeof Bun !== "undefined" ? Bun.version : undefined,
      },
    };

    if (request) {
      tags["url"] = request.url;
      tags["method"] = request.method;
      contexts["request"] = {
        method: request.method,
        url: request.url,
      };
    }

    const event: SentryEvent = {
      event_id: crypto.randomUUID().replace(/-/g, ""),
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

  private async forward(dsn: URL, event: SentryEvent): Promise<boolean> {
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
        body: JSON.stringify(event),
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
