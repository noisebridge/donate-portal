import type { FastifyInstance } from "fastify";

export default async function routes(fastify: FastifyInstance) {
  fastify.get("/", async (_request, reply) => {
    return reply.view(
      "index.ejs",
      { title: "Welcome" },
      { layout: "_layout.ejs" },
    );
  });
}
