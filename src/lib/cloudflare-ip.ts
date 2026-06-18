import { isIP } from "node:net";
import type { FastifyRequest } from "fastify";
import fp from "fastify-plugin";

/**
 * Resolve the real client IP from Cloudflare's `cf-connecting-ip` header.
 *
 * Returns the header value only when it is a valid IP address; otherwise
 * returns `undefined` so callers fall back to the socket address. This keeps a
 * missing or malformed header from poisoning logs or rate-limit keys.
 */
export function cloudflareClientIp(
  headers: FastifyRequest["headers"],
): string | undefined {
  const cloudflareIp = headers["cf-connecting-ip"];
  if (typeof cloudflareIp !== "string") {
    return;
  }
  if (isIP(cloudflareIp) === 0) {
    return;
  }

  return cloudflareIp;
}

/**
 * Behind Cloudflare the socket address is Cloudflare's edge rather than the
 * client, so override `request.ip` with the real client IP from the
 * `cf-connecting-ip` header. The override is installed as a getter to match
 * Fastify's own `ip` accessor on `Request.prototype`, making this as
 * transparent a swap as possible.
 */
export default fp(async (fastify) => {
  fastify.addHook("onRequest", async (request) => {
    const clientIp = cloudflareClientIp(request.headers);
    if (!clientIp) {
      return;
    }

    Object.defineProperty(request, "ip", {
      get: () => clientIp,
      configurable: true,
      enumerable: true,
    });
  });
});
