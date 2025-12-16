// biome-ignore lint/correctness/noUnusedImports: Html is used by JSX
import Html from "@kitajs/html";
import type { FastifyInstance } from "fastify";
import { IndexPage } from "~/views/index";

export default async function routes(fastify: FastifyInstance) {
  fastify.get("/", async (_request, reply) => {
    return reply.html(
      <IndexPage title="Welcome" />,
    );
  });
}
