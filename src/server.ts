import path from "node:path";
import { fileURLToPath } from "node:url";
import fastifyCookie from "@fastify/cookie";
import fastifyCsrf from "@fastify/csrf-protection";
import createError from "@fastify/error";
import fastifyFormbody from "@fastify/formbody";
import fastifyHelmet from "@fastify/helmet";
import fastifyRateLimit from "@fastify/rate-limit";
import fastifyStatic from "@fastify/static";
import fastifyWebsocket from "@fastify/websocket";
import html from "@kitajs/fastify-html-plugin";
import Fastify from "fastify";
import config from "~/config";
import { contentSecurityPolicy } from "~/csp";
import { baseLogger } from "~/logger";
import routes from "~/routes";
import errorReportingService from "~/services/error-reporting";

process.on("uncaughtException", (err) => {
  baseLogger.fatal(err, "Uncaught exception");
  errorReportingService.reportBackend(err).finally(() => process.exit(1));
});

process.on("unhandledRejection", (reason) => {
  const err = reason instanceof Error ? reason : new Error(String(reason));
  baseLogger.fatal(err, "Unhandled rejection");
  errorReportingService.reportBackend(err).finally(() => process.exit(1));
});

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const fastify = Fastify({
  loggerInstance: baseLogger,
});

fastify.register(fastifyCookie, {
  secret: config.cookieSecret,
});

fastify.register(fastifyCsrf, { sessionPlugin: "@fastify/cookie" });

fastify.register(fastifyHelmet, {
  contentSecurityPolicy,
});

fastify.register(fastifyFormbody, { bodyLimit: 1024 });

if (!config.disableRateLimit) {
  const RateLimitError = createError(
    "TOO_MANY_REQUESTS",
    "Rate limit exceeded",
    429,
  );

  fastify.register(fastifyRateLimit, {
    max: 256,
    timeWindow: "1 minute",
    errorResponseBuilder: (_req, _context) => new RateLimitError(),
  });
}

fastify.register(fastifyStatic, {
  root: path.join(__dirname, "assets"),
  prefix: "/assets/",
});

fastify.register(fastifyWebsocket);

fastify.register(html);

fastify.register(routes);

const start = async () => {
  try {
    await fastify.listen({ port: config.serverPort, host: "0.0.0.0" });
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

await start();
