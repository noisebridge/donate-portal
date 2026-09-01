import { describe, expect, test } from "bun:test";
import {
  ErrorCode,
  formatMessages,
  InfoCode,
  isErrorCodeKey,
  isInfoCodeKey,
} from "./error-codes";

describe("isErrorCodeKey", () => {
  test("accepts a known error key", () => {
    expect(isErrorCodeKey("InvalidRequest")).toBe(true);
  });

  test("rejects an unknown string", () => {
    expect(isErrorCodeKey("NotACode")).toBe(false);
  });

  test("rejects an error message value rather than its key", () => {
    expect(isErrorCodeKey(ErrorCode.InvalidRequest)).toBe(false);
  });

  test("rejects non-string query values", () => {
    expect(isErrorCodeKey(undefined)).toBe(false);
    expect(isErrorCodeKey(["InvalidRequest"])).toBe(false);
  });
});

describe("isInfoCodeKey", () => {
  test("accepts a known info key", () => {
    expect(isInfoCodeKey("SubscriptionCreated")).toBe(true);
  });

  test("rejects an unknown string", () => {
    expect(isInfoCodeKey("NotACode")).toBe(false);
  });

  test("rejects non-string query values", () => {
    expect(isInfoCodeKey(undefined)).toBe(false);
    expect(isInfoCodeKey(["SubscriptionCreated"])).toBe(false);
  });
});

describe("formatMessages", () => {
  test("returns nothing when neither param is set", () => {
    expect(formatMessages({})).toEqual([]);
  });

  test("formats an error code", () => {
    expect(formatMessages({ error: "InvalidRequest" })).toEqual([
      { type: "error", text: ErrorCode.InvalidRequest },
    ]);
  });

  test("formats an info code", () => {
    expect(formatMessages({ info: "SubscriptionCreated" })).toEqual([
      { type: "info", text: InfoCode.SubscriptionCreated },
    ]);
  });

  test("puts the error before the info when both are set", () => {
    expect(
      formatMessages({ error: "PastDue", info: "SubscriptionUpdated" }),
    ).toEqual([
      { type: "error", text: ErrorCode.PastDue },
      { type: "info", text: InfoCode.SubscriptionUpdated },
    ]);
  });
});
