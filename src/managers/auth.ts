import crypto from "node:crypto";
import type { FastifyReply, FastifyRequest } from "fastify";

export interface SessionData {
  email: string;
  provider: "github" | "google" | "magic_link";
}

export interface OAuthState {
  state: string;
}

export enum CookieName {
  GithubOAuthState = "github_oauth_state",
  GoogleOAuthState = "google_oauth_state",
  UserSession = "user_session",
}

class SignedCookie<T> {
  private readonly request: FastifyRequest;
  private readonly reply: FastifyReply;
  private readonly name: CookieName;
  private readonly maxAge: number;

  constructor(request: FastifyRequest, reply: FastifyReply, name: CookieName, maxAge: number) {
    this.request = request;
    this.reply = reply;
    this.name = name;
    this.maxAge = maxAge;
  }

  valid(): boolean {
    const signedValue = this.request.cookies[this.name];
    if (!signedValue) {
      return false;
    }

    const { valid, value } = this.request.unsignCookie(signedValue);
    return valid && value !== null;
  }

  get value(): T | null {
    const signedValue = this.request.cookies[this.name];
    if (!signedValue) {
      return null;
    }

    const { valid, value: rawValue } = this.request.unsignCookie(signedValue);
    if (!valid) {
      return null;
    }
    if (rawValue === null) {
      return null;
    }

    let parsedValue: unknown;
    try {
      parsedValue = JSON.parse(rawValue);
    } catch (e) {
      this.request.log.error(e, `Failed to parse ${this.name} cookie`);
      return null;
    }

    return parsedValue as T;
  }

  set value(newValue: T) {
    this.reply.setCookie(this.name, JSON.stringify(newValue), {
      signed: true,
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: this.maxAge,
    });
  }

  clear() {
    this.reply.clearCookie(this.name, { path: "/" });
  }
}

export const cookies = {
  [CookieName.UserSession]: (request: FastifyRequest, reply: FastifyReply) => new SignedCookie<SessionData>(request, reply, CookieName.UserSession, 60 * 60 * 24 * 7),
  [CookieName.GithubOAuthState]: (request: FastifyRequest, reply: FastifyReply) => new SignedCookie<OAuthState>(request, reply, CookieName.GithubOAuthState, 60 * 10),
  [CookieName.GoogleOAuthState]: (request: FastifyRequest, reply: FastifyReply) => new SignedCookie<OAuthState>(request, reply, CookieName.GoogleOAuthState, 60 * 10),
} as const;

export function getRandomState() {
  return crypto.randomBytes(32).toString("hex");
}
