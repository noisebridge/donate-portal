import type { CookieSerializeOptions } from "@fastify/cookie";
import type { FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import config from "~/config";

export const SessionDataSchema = z.object({
  email: z.string(),
  provider: z.enum(["github", "google", "magic_link"]),
  issued: z.number(),
});

export type SessionData = z.infer<typeof SessionDataSchema>;

export const OAuthDataSchema = z.object({
  state: z.string(),
  issued: z.number(),
});

export type OAuthData = z.infer<typeof OAuthDataSchema>;

export enum CookieName {
  GithubOAuthState = "github_oauth_state",
  GoogleOAuthState = "google_oauth_state",
  UserSession = "user_session",
}

class SignedCookie<T extends { issued: number }> {
  static readonly baseOptions: CookieSerializeOptions = {
    secure: config.serverProtocol === "https",
    sameSite: "lax",
    path: "/",
    signed: true,
    httpOnly: true,
  };

  private readonly request: FastifyRequest;
  private readonly reply: FastifyReply;
  private readonly name: CookieName;
  private readonly maxAge: number;
  private readonly schema: z.ZodType<T>;

  constructor(
    name: CookieName,
    schema: z.ZodType<T>,
    request: FastifyRequest,
    reply: FastifyReply,
    maxAge: number,
  ) {
    this.request = request;
    this.reply = reply;
    this.name = name;
    this.maxAge = maxAge;
    this.schema = schema;
  }

  valid(): boolean {
    return this.value !== null;
  }

  get value(): T | null {
    const signedValue = this.request.cookies[this.name];
    if (!signedValue) {
      return null;
    }

    const { valid, value: rawValue } = this.request.unsignCookie(signedValue);
    if (!valid || rawValue === null) {
      return null;
    }

    let parsedValue: unknown;
    try {
      parsedValue = JSON.parse(rawValue);
    } catch (e) {
      this.request.log.error(e, `Failed to parse ${this.name} cookie`);
      return null;
    }

    const result = this.schema.safeParse(parsedValue);
    if (!result.success) {
      this.request.log.error(result.error, `Invalid ${this.name} cookie data`);
      return null;
    }

    if (Date.now() - result.data.issued > this.maxAge * 1000) {
      this.clear();
      return null;
    }

    return result.data;
  }

  set value(newValue: T) {
    this.reply.setCookie(this.name, JSON.stringify(newValue), {
      ...SignedCookie.baseOptions,
      maxAge: this.maxAge,
    });
  }

  clear() {
    this.reply.clearCookie(this.name, SignedCookie.baseOptions);
  }
}

export const cookies = {
  [CookieName.UserSession]: (request: FastifyRequest, reply: FastifyReply) =>
    new SignedCookie(
      CookieName.UserSession,
      SessionDataSchema,
      request,
      reply,
      60 * 60 * 24,
    ),
  [CookieName.GithubOAuthState]: (
    request: FastifyRequest,
    reply: FastifyReply,
  ) =>
    new SignedCookie(
      CookieName.GithubOAuthState,
      OAuthDataSchema,
      request,
      reply,
      60 * 10,
    ),
  [CookieName.GoogleOAuthState]: (
    request: FastifyRequest,
    reply: FastifyReply,
  ) =>
    new SignedCookie(
      CookieName.GoogleOAuthState,
      OAuthDataSchema,
      request,
      reply,
      60 * 10,
    ),
} as const;
