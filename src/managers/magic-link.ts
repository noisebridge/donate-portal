import crypto from "node:crypto";
import config from "~/config";
import { baseLogger } from "~/logger";
import paths from "~/paths";

interface MagicLinkState {
  email: string;
  code: string;
}

const totpWindow = 5 * 60 * 1000; // milliseconds

export class MagicLinkManager {
  static readonly log = baseLogger.child({ class: "MagicLinkManager" });

  /**
   * Verify magic link code is valid for the given email.
   * Checks current time window, plus 1 past and 1 future window.
   */
  verifyMagicLinkCode(
    email: string,
    code: string,
    timestamp: number = Date.now(),
  ) {
    // Check 1 past, current, and 1 future time window
    for (let offset = -1; offset <= 1; offset++) {
      const checkTimestamp = timestamp + offset * totpWindow;
      const windowCode = this.generateMagicLinkCode(email, checkTimestamp);
      if (windowCode === code) {
        return true;
      }
    }

    return false;
  }

  /**
   * Generate a complete magic link URL with encoded state.
   */
  generateMagicLinkUrl(email: string) {
    const code = this.generateMagicLinkCode(email);
    const state: MagicLinkState = { email, code };
    const encodedState = Buffer.from(JSON.stringify(state)).toString("base64");

    return `${config.baseUrl}${paths.emailCallback(encodedState)}`;
  }

  /**
   * Decode and verify magic link state parameter.
   */
  decodeMagicLinkState(encodedState: string) {
    const decoded = Buffer.from(encodedState, "base64").toString("utf-8");

    let state: unknown;
    try {
      state = JSON.parse(decoded) as unknown;
    } catch (e) {
      MagicLinkManager.log.error(e);
      return null;
    }

    if (typeof state !== "object" || Array.isArray(state) || state === null) {
      MagicLinkManager.log.error("Magic link state not an object");
      return null;
    }
    if (!("code" in state) || !("email" in state)) {
      MagicLinkManager.log.error(
        "Magic link state object missing code or email key",
      );
      return null;
    }
    if (
      typeof state["code"] !== "string" ||
      typeof state["email"] !== "string"
    ) {
      MagicLinkManager.log.error("Magic link code or email is not a string");
      return null;
    }

    return state as MagicLinkState;
  }

  /**
   * Generate HMAC-based code for magic link authentication
   */
  private generateMagicLinkCode(email: string, timestamp: number = Date.now()) {
    const timeWindow = Math.floor(timestamp / totpWindow);

    const hmac = crypto.createHmac("sha256", config.totpSecret);
    hmac.update(`${email}:${timeWindow}`);

    return hmac.digest("hex");
  }
}

const magicLinkManager = new MagicLinkManager();
export default magicLinkManager;
