import path from "node:path";
import { fileURLToPath } from "node:url";
import fastifyCookie from "@fastify/cookie";
import fastifyFormbody from "@fastify/formbody";
import fastifyRateLimit from "@fastify/rate-limit";
import fastifyStatic from "@fastify/static";
import html from "@kitajs/fastify-html-plugin";
import Fastify from "fastify";
import config from "~/config";
import routes, { errorRoute } from "~/routes";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const fastify = Fastify({
  logger: true,
});

fastify.register(fastifyCookie, {
  secret: config.cookieSecret,
});

fastify.register(fastifyFormbody, { bodyLimit: 1024 });

fastify.register(fastifyRateLimit, { max: 256, timeWindow: "1 minute" });

fastify.register(fastifyStatic, {
  root: path.join(__dirname, "assets"),
  prefix: "/assets/",
});

fastify.register(html);

/**
 * Add a `Content-Security-Policy` header to all HTML responses.
 */
fastify.addHook("onSend", async (_request, reply) => {
  const contentType = reply.getHeader("content-type");
  if (typeof contentType !== "string") {
    return;
  }
  if (!contentType.startsWith("text/html")) {
    return;
  }

  const cspDirectives: Record<string, string[]> = {
    "default-src": ["'self'"],
    "script-src": ["'self'"],
    "style-src": ["'self'"],
    "img-src": ["'self'", "data:"],
    "font-src": ["'self'"],
    "connect-src": ["'self'"],
    "form-action": ["'self'"],
    "frame-ancestors": ["'none'"],
    "base-uri": ["'self'"],
    "object-src": ["'none'"],
  };

  const cspHeader = Object.entries(cspDirectives)
    .map(([directive, values]) => `${directive} ${values.join(" ")}`)
    .concat("upgrade-insecure-requests")
    .join("; ");

  reply.header("Content-Security-Policy", cspHeader);
});

fastify.register(routes);
fastify.setErrorHandler(errorRoute(fastify));

const start = async () => {
  try {
    await fastify.listen({ port: config.serverPort, host: "0.0.0.0" });
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

start();
