import "fastify";

declare module "fastify" {
  interface FastifyRequest {
    /**
     * Unprocessed body `Buffer` added by the `rawBody` function.
     */
    rawBody?: Buffer;
  }
}
