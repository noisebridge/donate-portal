import fastifyCookie from "@fastify/cookie";
import fastifyCsrf from "@fastify/csrf-protection";
import createError from "@fastify/error";
import fastifyFormbody from "@fastify/formbody";
import fastifyHelmet from "@fastify/helmet";
import fastifyRateLimit from "@fastify/rate-limit";
import fastifyWebsocket from "@fastify/websocket";
import html from "@kitajs/fastify-html-plugin";
import Fastify from "fastify";
import config from "~/config";
import assets from "~/lib/assets";
import contentSecurityPolicy from "~/lib/content-security-policy";
import baseLogger from "~/lib/logger";
import permissionsPolicy from "~/lib/permissions-policy";
import routes, { maxRawBodyBytes } from "~/routes";
import * as errorReportingService from "~/services/error-reporting";

process.on("uncaughtException", (err) => {
  baseLogger.fatal(err, "Uncaught exception");
  errorReportingService.reportBackend(err).finally(() => process.exit(1));
});

process.on("unhandledRejection", (reason) => {
  const err = reason instanceof Error ? reason : new Error(String(reason));
  baseLogger.fatal(err, "Unhandled rejection");
  errorReportingService.reportBackend(err).finally(() => process.exit(1));
});

const fastify = Fastify({
  loggerInstance: baseLogger,
  bodyLimit: maxRawBodyBytes,
  trustProxy: 1,
});

fastify.register(fastifyCookie, {
  secret: config.cookieSecret,
});

fastify.register(fastifyCsrf, {
  sessionPlugin: "@fastify/cookie",
  cookieOpts: {
    secure: config.serverProtocol === "https",
    httpOnly: true,
    sameSite: "strict",
    path: "/",
  },
});

fastify.register(fastifyHelmet, { contentSecurityPolicy: false });

fastify.register(contentSecurityPolicy);

fastify.register(permissionsPolicy);

fastify.register(fastifyFormbody, { bodyLimit: 1024 });

fastify.addContentTypeParser(
  "application/csp-report",
  { parseAs: "string" },
  fastify.getDefaultJsonParser("ignore", "ignore"),
);

if (!config.disableRateLimit) {
  const RateLimitError = createError(
    "TOO_MANY_REQUESTS",
    "Rate limit exceeded",
    429,
  );

  fastify.register(fastifyRateLimit, {
    max: 256,
    timeWindow: "1 minute",
    allowList: config.rateLimitAllowList,
    keyGenerator: (request) => request.ip,
    errorResponseBuilder: (_request, _context) => new RateLimitError(),
  });
}

fastify.register(assets);

fastify.register(fastifyWebsocket);

fastify.register(html);

fastify.register(routes);

await fastify.listen({ port: config.serverPort, host: "0.0.0.0" });
