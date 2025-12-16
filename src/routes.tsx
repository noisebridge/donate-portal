// biome-ignore lint/correctness/noUnusedImports: Html is used by JSX
import Html from "@kitajs/html";
import type { FastifyInstance } from "fastify";
import { IndexPage } from "~/views/index";
import { AuthPage } from "./views/auth";

export default async function routes(fastify: FastifyInstance) {
  fastify.get("/", async (_request, reply) => {
    return reply.html(
      <IndexPage title="Donate to Noisebridge" />,
    );
  });

  fastify.get("/auth", async (_request, reply) => {
    return reply.html(
      <AuthPage title="Sign In" />,
    );
  });
}
