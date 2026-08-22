import { describe, expect, test } from "bun:test";
import Fastify from "fastify";
import config from "~/config";

/**
 * Fastify 5.12.1 silently turned `trustProxy: <number>` into "trust nothing"
 * (see @fastify/proxy-addr getTrustProxyFn). These assert the configured value
 * actually makes the proxy's X-Forwarded-For win, so a repeat regression fails
 * loudly instead of quietly keying rate limits on the proxy's IP.
 */
describe("trustProxy config", () => {
  async function requestIp(remoteAddress: string) {
    const app = Fastify({ trustProxy: config.trustedProxies });
    app.get("/", (request) => ({ ip: request.ip }));
    const response = await app.inject({
      method: "GET",
      url: "/",
      remoteAddress,
      headers: { "x-forwarded-for": "203.0.113.7" },
    });
    await app.close();
    return response.json().ip;
  }

  // The gateway pod's own address, as measured in noisegarden's
  // docs/findings/istio/gateway-real-client-ip.md.
  test("uses X-Forwarded-For when the peer is the Istio gateway pod", async () => {
    expect(await requestIp("10.244.0.9")).toBe("203.0.113.7");
  });

  test("ignores X-Forwarded-For from an untrusted peer", async () => {
    expect(await requestIp("198.51.100.4")).toBe("198.51.100.4");
  });

  // The deployed TRUSTED_PROXIES (noisegarden donate-portal/deployment.yaml) is
  // narrower than the default on purpose: the LAN reaches the gateway with its
  // source IP preserved, so a LAN client appears in X-Forwarded-For, and
  // trusting its range would let it prepend a spoofed hop.
  test("the deployed proxy range excludes the Noisebridge LAN", async () => {
    const app = Fastify({ trustProxy: "10.244.0.0/16" });
    app.get("/", (request) => ({ ip: request.ip }));
    const response = await app.inject({
      method: "GET",
      url: "/",
      remoteAddress: "10.244.0.9",
      headers: { "x-forwarded-for": "1.2.3.4, 10.21.0.50" },
    });
    await app.close();
    expect(response.json().ip).toBe("10.21.0.50");
  });
});
