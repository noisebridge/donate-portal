import crypto from "node:crypto";
import { z } from "zod";
import config from "~/config";
import baseLogger from "~/logger";
import paths from "~/paths";

const magicLinkStateSchema = z.object({
  email: z.string(),
  code: z.string(),
});
type MagicLinkState = z.infer<typeof magicLinkStateSchema>;

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
  decodeMagicLinkState(encodedState: string): MagicLinkState | null {
    let json: unknown;
    try {
      const decoded = Buffer.from(encodedState, "base64").toString("utf-8");
      json = JSON.parse(decoded);
    } catch (e) {
      MagicLinkManager.log.error(e);
      return null;
    }

    const result = magicLinkStateSchema.safeParse(json);
    if (!result.success) {
      MagicLinkManager.log.error(result.error.message);
      return null;
    }

    return result.data;
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
