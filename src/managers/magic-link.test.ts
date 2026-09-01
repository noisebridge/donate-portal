import { describe, expect, test } from "bun:test";
import config from "~/config";
import paths from "~/lib/paths";
import * as magicLinkManager from "./magic-link";

/**
 * Encode a value as base64 JSON string
 */
function encodeBase64Json(value: unknown): string {
  return Buffer.from(JSON.stringify(value)).toString("base64");
}

/**
 * Extract the magic link code from a generated URL.
 * Returns the decoded state containing email and code.
 */
function extractMagicLinkCode(
  manager: typeof magicLinkManager,
  url: string,
): { email: string; code: string } {
  const stateMatch = url.match(/\?state=([^&]+)/);
  if (!stateMatch?.[1]) {
    throw new Error("No state parameter found in URL");
  }

  const decodedState = manager.decodeState(stateMatch[1]);
  if (!decodedState) {
    throw new Error("Failed to decode magic link state");
  }

  return decodedState;
}

describe("magic-link", () => {
  const manager = magicLinkManager;

  describe("generateUrl", () => {
    test("returns URL starting with config.baseUrl + emailCallback path", () => {
      const url = manager.generateUrl("test@example.com");

      expect(url).toStartWith(config.baseUrl);
      expect(url).toStartWith(`${config.baseUrl}${paths.emailCallback()}`);
    });

    test("state is valid base64", () => {
      const url = manager.generateUrl("test@example.com");

      const stateMatch = url.match(/\?state=([^&]+)/);
      if (stateMatch === null) {
        expect(stateMatch).not.toBeNull();
        return;
      }

      const state = stateMatch[1];
      if (state === undefined) {
        expect(state).not.toBeUndefined();
        return;
      }

      // Should not throw when decoding
      const decoded = Buffer.from(state, "base64").toString("utf-8");
      expect(decoded.length).toBeGreaterThan(0);

      // Should be valid JSON
      const parsed = JSON.parse(decoded);
      expect(parsed).toHaveProperty("email");
      expect(parsed).toHaveProperty("code");
    });
  });

  describe("decodeState", () => {
    test("decodes valid state and returns { email, code }", () => {
      const encoded = encodeBase64Json({
        email: "test@example.com",
        code: "abc123",
      });

      const result = manager.decodeState(encoded);

      if (result === null) {
        expect(result).not.toBeNull();
        return;
      }

      expect(result.email).toBe("test@example.com");
      expect(result.code).toBe("abc123");
    });

    test("returns null for invalid base64", () => {
      const result = manager.decodeState("!!!invalid!!!");

      expect(result).toBeNull();
    });

    test("returns null for valid base64 but invalid JSON", () => {
      const encoded = Buffer.from("not valid json {{{").toString("base64");

      const result = manager.decodeState(encoded);

      expect(result).toBeNull();
    });

    test("returns null for JSON missing required fields", () => {
      expect(
        manager.decodeState(encodeBase64Json({ email: "test@example.com" })),
      ).toBeNull();
      expect(
        manager.decodeState(encodeBase64Json({ code: "abc123" })),
      ).toBeNull();
      expect(manager.decodeState(encodeBase64Json({}))).toBeNull();
    });

    test("returns null for non-object JSON", () => {
      expect(manager.decodeState(encodeBase64Json(["a", "b"]))).toBeNull();
      expect(manager.decodeState(encodeBase64Json("hello"))).toBeNull();
      expect(manager.decodeState(encodeBase64Json(123))).toBeNull();
      expect(manager.decodeState(encodeBase64Json(null))).toBeNull();
    });

    test("returns null for non-string email or code", () => {
      expect(
        manager.decodeState(encodeBase64Json({ email: 123, code: "abc" })),
      ).toBeNull();
      expect(
        manager.decodeState(
          encodeBase64Json({ email: "test@example.com", code: 123 }),
        ),
      ).toBeNull();
    });
  });

  describe("verifyCode", () => {
    test("returns true for valid code with matching email and recent timestamp", () => {
      const email = "test@example.com";
      const url = manager.generateUrl(email);
      const { code } = extractMagicLinkCode(manager, url);

      const result = manager.verifyCode(email, code, Date.now());

      expect(result).toBe(true);
    });

    test("returns false for wrong email", () => {
      const url = manager.generateUrl("test@example.com");
      const { code } = extractMagicLinkCode(manager, url);

      const result = manager.verifyCode("wrong@example.com", code, Date.now());

      expect(result).toBe(false);
    });

    test("returns false for wrong code", () => {
      const result = manager.verifyCode(
        "test@example.com",
        "wrongcode123",
        Date.now(),
      );

      expect(result).toBe(false);
    });

    test("returns false for timestamp older than allowed window", () => {
      const email = "test@example.com";
      const url = manager.generateUrl(email);
      const { code } = extractMagicLinkCode(manager, url);

      // 15 minutes in the past (beyond the 5-minute window + 1 past window = 10 min)
      const oldTimestamp = Date.now() - 15 * 60 * 1000;

      const result = manager.verifyCode(email, code, oldTimestamp);

      expect(result).toBe(false);
    });

    test("accepts code within one past time window", () => {
      const email = "test@example.com";
      const url = manager.generateUrl(email);
      const { code } = extractMagicLinkCode(manager, url);

      // 4 minutes ago (within the -1 window check)
      const pastTimestamp = Date.now() - 4 * 60 * 1000;

      const result = manager.verifyCode(email, code, pastTimestamp);

      expect(result).toBe(true);
    });

    test("accepts code within one future time window", () => {
      const email = "test@example.com";
      const url = manager.generateUrl(email);
      const { code } = extractMagicLinkCode(manager, url);

      // 4 minutes in the future
      const futureTimestamp = Date.now() + 4 * 60 * 1000;

      const result = manager.verifyCode(email, code, futureTimestamp);

      expect(result).toBe(true);
    });
  });
});
