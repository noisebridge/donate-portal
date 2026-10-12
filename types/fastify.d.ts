import "fastify";

declare module "fastify" {
  interface FastifyRequest {
    /**
     * Unprocessed body `Buffer` added by the `rawBody` function.
     */
    rawBody?: Buffer;
  }

  interface FastifyReply {
    /** Sends a JSX element as an HTML response. Added by `~/lib/html-reply`. */
    html(element: JSX.Element): FastifyReply;
  }
}
