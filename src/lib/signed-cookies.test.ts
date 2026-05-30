import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import fastifyCookie from "@fastify/cookie";
import Fastify, { type FastifyInstance } from "fastify";
import { CookieName, cookies, type SessionData } from "./signed-cookies";

type InjectResponse = Awaited<ReturnType<FastifyInstance["inject"]>>;

function newCookieValues(response: InjectResponse): string[] {
  const setCookie = response.headers["set-cookie"];

  switch (typeof setCookie) {
    case "string":
      return [setCookie];
    case "object":
      return setCookie;
    case "undefined":
      return [];
  }
}

const COOKIE_SECRET = "test-cookie-secret";

describe("SignedCookie", () => {
  let app: FastifyInstance;

  function signValue(raw: string): string {
    return app.signCookie(raw);
  }

  function signJson(value: unknown): string {
    return signValue(JSON.stringify(value));
  }

  function cookieHeader(signed: string): string {
    return `${CookieName.UserSession}=${signed}`;
  }

  beforeAll(async () => {
    app = Fastify();
    await app.register(fastifyCookie, { secret: COOKIE_SECRET });

    app.get("/parse-cookie", (request, reply) => {
      const session = cookies[CookieName.UserSession](request, reply);
      reply.send({ value: session.value, valid: session.valid() });
    });

    app.post("/set-cookie", (request, reply) => {
      const session = cookies[CookieName.UserSession](request, reply);
      session.value = request.body as SessionData;
      reply.send({ ok: true });
    });

    app.post("/clear-cookie", (request, reply) => {
      const session = cookies[CookieName.UserSession](request, reply);
      session.clear();
      reply.send({ ok: true });
    });

    await app.ready();
  });

  afterAll(() => app.close());

  describe("getting a cookie value", () => {
    test("returns parsed data for a valid session cookie", async () => {
      const data: SessionData = {
        email: "test@example.com",
        provider: "github",
        issued: Date.now(),
      };
      const response = await app.inject({
        method: "GET",
        url: "/parse-cookie",
        headers: { cookie: cookieHeader(signJson(data)) },
      });

      expect(JSON.parse(response.body)).toEqual({ value: data, valid: true });
    });

    test("returns null when no cookie is present", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/parse-cookie",
      });
      expect(JSON.parse(response.body)).toEqual({ value: null, valid: false });
    });

    test("returns null when signature is invalid", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/parse-cookie",
        headers: { cookie: cookieHeader("tampered.garbage") },
      });

      expect(JSON.parse(response.body)).toEqual({ value: null, valid: false });
    });

    test("returns null when cookie value is not valid JSON", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/parse-cookie",
        headers: { cookie: cookieHeader(signValue("not{json")) },
      });

      expect(JSON.parse(response.body)).toEqual({ value: null, valid: false });
    });

    test("returns null when data does not match schema", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/parse-cookie",
        headers: { cookie: cookieHeader(signJson({ wrong: "shape" })) },
      });

      expect(JSON.parse(response.body)).toEqual({ value: null, valid: false });
    });

    test("returns null when cookie is expired", async () => {
      const data: SessionData = {
        email: "test@example.com",
        provider: "github",
        issued: Date.now() - 365 * 24 * 60 * 60 * 1000,
      };
      const response = await app.inject({
        method: "GET",
        url: "/parse-cookie",
        headers: { cookie: cookieHeader(signJson(data)) },
      });

      expect(JSON.parse(response.body)).toEqual({ value: null, valid: false });
    });
  });

  describe("expiration clears the cookie", () => {
    test("sends a set-cookie header to clear an expired cookie", async () => {
      const data: SessionData = {
        email: "test@example.com",
        provider: "github",
        issued: Date.now() - 25 * 60 * 60 * 1000,
      };
      const response = await app.inject({
        method: "GET",
        url: "/parse-cookie",
        headers: { cookie: cookieHeader(signJson(data)) },
      });

      const sessionCookie = newCookieValues(response).find((c) =>
        c.startsWith(CookieName.UserSession),
      );
      expect(sessionCookie).toBe(
        `${CookieName.UserSession}=; Max-Age=0; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT; HttpOnly; SameSite=Lax`,
      );
    });

    test("does not send a set-cookie header for a valid cookie", async () => {
      const data: SessionData = {
        email: "test@example.com",
        provider: "github",
        issued: Date.now(),
      };
      const response = await app.inject({
        method: "GET",
        url: "/parse-cookie",
        headers: { cookie: cookieHeader(signJson(data)) },
      });

      expect(response.headers["set-cookie"]).toBeUndefined();
    });
  });

  describe("setting a cookie", () => {
    test("sends a set-cookie header", async () => {
      const data: SessionData = {
        email: "test@example.com",
        provider: "magic_link",
        issued: Date.now(),
      };
      const response = await app.inject({
        method: "POST",
        url: "/set-cookie",
        payload: data,
      });

      const cookies = newCookieValues(response);
      expect(cookies).not.toBeEmpty();

      const sessionCookie = cookies.find((cookie) =>
        cookie.startsWith(CookieName.UserSession),
      );
      expect(sessionCookie).toBeDefined();
    });

    test("round-trips a cookie through set then get", async () => {
      const data: SessionData = {
        email: "roundtrip@example.com",
        provider: "google",
        issued: Date.now(),
      };

      const setResponse = await app.inject({
        method: "POST",
        url: "/set-cookie",
        payload: data,
      });
      const cookies = newCookieValues(setResponse);
      const rawSetCookie = cookies.find((cookie) =>
        cookie.startsWith(CookieName.UserSession),
      );
      if (!rawSetCookie) {
        throw new Error("No session cookie set");
      }

      const cookieValue = rawSetCookie.split(";")[0];

      const getResponse = await app.inject({
        method: "GET",
        url: "/parse-cookie",
        headers: { cookie: cookieValue },
      });

      expect(JSON.parse(getResponse.body)).toEqual({
        value: data,
        valid: true,
      });
    });
  });

  describe("clearing a cookie", () => {
    test("sends a set-cookie header that expires the cookie", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/clear-cookie",
      });

      const sessionCookie = newCookieValues(response).find((cookie) =>
        cookie.startsWith(CookieName.UserSession),
      );
      expect(sessionCookie).toBe(
        `${CookieName.UserSession}=; Max-Age=0; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT; HttpOnly; SameSite=Lax`,
      );
    });
  });
});
