import crypto from "node:crypto";
import { z } from "zod";
import config from "~/config";
import baseLogger from "~/lib/logger";
import paths from "~/lib/paths";
import { timingSafeStringEqual } from "~/lib/timing-safe-equal";

const MAGIC_LINK_STATE_SCHEMA = z.object({
  email: z.string(),
  code: z.string(),
});
type MagicLinkState = z.infer<typeof MAGIC_LINK_STATE_SCHEMA>;

const TOTP_WINDOW_MS = 5 * 60 * 1000;

const log = baseLogger.child({ module: "magic-link" });

/**
 * Verify magic link code is valid for the given email.
 * Checks current time window, plus 1 past and 1 future window.
 */
export function verifyCode(
  email: string,
  code: string,
  timestamp: number = Date.now(),
) {
  // Check 1 past, current, and 1 future time window
  for (let offset = -1; offset <= 1; offset++) {
    const checkTimestamp = timestamp + offset * TOTP_WINDOW_MS;
    const windowCode = generateCode(email, checkTimestamp);
    if (timingSafeStringEqual(windowCode, code)) {
      return true;
    }
  }

  return false;
}

/**
 * Generate a complete magic link URL with encoded state.
 */
export function generateUrl(email: string) {
  const code = generateCode(email);
  const state: MagicLinkState = { email, code };
  const encodedState = Buffer.from(JSON.stringify(state)).toString("base64");

  return `${config.baseUrl}${paths.emailCallback(encodedState)}`;
}

/**
 * Decode and verify magic link state parameter.
 */
export function decodeState(encodedState: string): MagicLinkState | null {
  let json: unknown;
  try {
    const decoded = Buffer.from(encodedState, "base64").toString("utf-8");
    json = JSON.parse(decoded);
  } catch (e) {
    log.error(e);
    return null;
  }

  const result = MAGIC_LINK_STATE_SCHEMA.safeParse(json);
  if (!result.success) {
    log.error(result.error.message);
    return null;
  }

  return result.data;
}

/**
 * Generate HMAC-based code for magic link authentication
 */
function generateCode(email: string, timestamp: number = Date.now()) {
  const timeWindow = Math.floor(timestamp / TOTP_WINDOW_MS);

  const hmac = crypto.createHmac("sha256", config.totpSecret);
  hmac.update(`${email}:${timeWindow}`);

  return hmac.digest("hex");
}
