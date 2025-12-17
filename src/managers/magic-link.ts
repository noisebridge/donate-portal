import crypto from "node:crypto";

const totpSecret = process.env["TOTP_SECRET"];
if (!totpSecret) {
  throw new Error("TOTP_SECRET env var is not set");
}

const serverHost = process.env["SERVER_HOST"];
if (!serverHost) {
  throw new Error("SERVER_HOST env var is not set");
}

interface MagicLinkState {
  email: string;
  code: string;
}

const totpWindow = 5 * 60 * 1000;

/**
 * Generate HMAC-based code for magic link authentication
 * Code is valid for 5-minute time windows
 */
export function generateMagicLinkCode(email: string, timestamp: number = Date.now()): string {
  // Calculate 5-minute time window
  const timeWindow = Math.floor(timestamp / totpWindow);

  // Create HMAC using email:totpSecret:timeWindow format as specified
  const data = `${email}:${totpSecret}:${timeWindow}`;
  // biome-ignore lint/style/noNonNullAssertion: totpSecret is already checked
  const hmac = crypto.createHmac("sha256", totpSecret!);
  hmac.update(data);

  return hmac.digest("hex");
}

/**
 * Verify magic link code is valid for the given email
 * Checks current time window, plus 1 past and 1 future window (15 minutes total)
 */
export function verifyMagicLinkCode(email: string, code: string, timestamp: number = Date.now()): boolean {
  // Check 1 past, current, and 1 future time window
  for (let offset = -1; offset <= 1; offset++) {
    const checkTimestamp = timestamp + (offset * totpWindow);
    const checkCode = generateMagicLinkCode(email, checkTimestamp);

    if (checkCode === code) {
      return true;
    }
  }

  return false;
}

/**
 * Generate a complete magic link URL with encoded state
 */
export function generateMagicLinkUrl(email: string): string {
  const code = generateMagicLinkCode(email);
  const state: MagicLinkState = { email, code };
  const encodedState = Buffer.from(JSON.stringify(state)).toString("base64");

  const protocol = process.env.NODE_ENV === "production" ? "https" : "http";
  return `${protocol}://${serverHost}/auth/magic-link/callback?state=${encodedState}`;
}

/**
 * Decode and verify magic link state parameter
 */
export function decodeMagicLinkState(encodedState: string): MagicLinkState | null {
  try {
    const decoded = Buffer.from(encodedState, "base64").toString("utf-8");
    const state = JSON.parse(decoded) as unknown;
    if (typeof state !== "object" || Array.isArray(state) || state === null) {
      console.error("Magic link state not an object");
      return null;
    }
    if (!("code" in state) || !("email" in state)) {
      console.error("Magic link state object missing code or email key");
      return null;
    }
    if (typeof state["code"] !== "string" || typeof state["email"] !== "string") {
      console.error("Magic link code or email is not a string");
      return null;
    }

    return state as MagicLinkState;
  } catch (e) {
    console.log(e);
    return null;
  }
}
