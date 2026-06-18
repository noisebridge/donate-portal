import { describe, expect, test } from "bun:test";
import Fastify from "fastify";
import cloudflareIp, { cloudflareClientIp } from "./cloudflare-ip";

describe("cloudflareClientIp", () => {
  test("returns the address for a valid IPv4 header", () => {
    expect(cloudflareClientIp({ "cf-connecting-ip": "203.0.113.7" })).toBe(
      "203.0.113.7",
    );
  });

  test("returns the address for a valid IPv6 header", () => {
    expect(cloudflareClientIp({ "cf-connecting-ip": "2001:db8::1" })).toBe(
      "2001:db8::1",
    );
  });

  test("returns undefined when the header is missing", () => {
    expect(cloudflareClientIp({})).toBeUndefined();
  });

  test("returns undefined when the header is not a valid IP", () => {
    expect(
      cloudflareClientIp({ "cf-connecting-ip": "not-an-ip" }),
    ).toBeUndefined();
  });
});

describe("cloudflare-ip plugin", () => {
  interface TestResponse {
    ip: string;
  }

  async function buildServer() {
    const fastify = Fastify();
    await fastify.register(cloudflareIp);
    fastify.get<{ Reply: TestResponse }>("/", (req) => ({ ip: req.ip }));
    return fastify;
  }

  test("overrides request.ip with the cf-connecting-ip address", async () => {
    const fastify = await buildServer();

    const response = await fastify.inject({
      method: "GET",
      url: "/",
      headers: { "cf-connecting-ip": "203.0.113.7" },
    });

    expect(response.json<TestResponse>()).toEqual({ ip: "203.0.113.7" });
    await fastify.close();
  });

  test("leaves request.ip untouched without a valid header", async () => {
    const fastify = await buildServer();

    const response = await fastify.inject({
      method: "GET",
      url: "/",
      headers: { "cf-connecting-ip": "not-an-ip" },
    });

    // Falls back to the socket address (loopback for injected requests).
    expect(response.json<TestResponse>()).toEqual({ ip: "127.0.0.1" });
    await fastify.close();
  });
});
