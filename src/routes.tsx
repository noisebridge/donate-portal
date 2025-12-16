// biome-ignore lint/correctness/noUnusedImports: Html is used by JSX
import Html from "@kitajs/html";
import type { FastifyInstance } from "fastify";
import stripe from "~/stripe.ts";
import { IndexPage } from "~/views/index.tsx";

export default async function routes(fastify: FastifyInstance) {
  fastify.get("/", async (_request, reply) => {
    reply.setCookie("user", "john", {
      signed: true,
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 7, // 7 days in seconds
    });

    const customerEmail = (await stripe.customers.list()).data[0]?.email ?? "";
    return reply.html(
      <IndexPage title="Welcome" customerEmail={customerEmail} />,
    );
  });
}
