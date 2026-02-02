import { sign } from "@fastify/cookie";
import type { BrowserContext } from "@playwright/test";
import config from "~/config";
import { CookieName, type SessionData } from "~/signed-cookies";

/**
 * Set a signed session cookie on the browser context to authenticate.
 */
export async function setAuthCookie(
  context: BrowserContext,
  email: string,
  provider: SessionData["provider"],
): Promise<void> {
  const sessionData: SessionData = { email, provider };
  const signed = sign(JSON.stringify(sessionData), config.cookieSecret);

  await context.addCookies([
    {
      name: CookieName.UserSession,
      value: signed,
      domain: new URL(config.baseUrl).hostname,
      path: "/",
      httpOnly: true,
      sameSite: "Lax",
    },
  ]);
}
