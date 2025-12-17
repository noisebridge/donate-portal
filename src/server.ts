import path from "node:path";
import { fileURLToPath } from "node:url";
import fastifyCookie from "@fastify/cookie";
import fastifyFormbody from "@fastify/formbody";
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

fastify.register(fastifyFormbody);

fastify.register(fastifyStatic, {
  root: path.join(__dirname, "assets"),
  prefix: "/assets/",
});

fastify.register(html);

fastify.register(routes);
fastify.setErrorHandler(errorRoute(fastify));

const start = async () => {
  try {
    await fastify.listen({ port: 3000, host: "0.0.0.0" });
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

start();
