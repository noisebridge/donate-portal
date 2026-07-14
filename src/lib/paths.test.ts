import { describe, expect, test } from "bun:test";
import paths, { formatPath } from "./paths";

describe("formatPath", () => {
  test("returns path unchanged when no params given", () => {
    expect(formatPath("/donate")).toBe("/donate");
  });

  test("returns path unchanged for empty params object", () => {
    expect(formatPath("/donate", {})).toBe("/donate");
  });

  test("appends a single string param", () => {
    expect(formatPath("/auth/email", { email: "a@b.com" })).toBe(
      "/auth/email?email=a%40b.com",
    );
  });

  test("appends multiple params", () => {
    const result = formatPath("/qr", { name: "coffee", amount: 5 });
    const url = new URL(result, "http://localhost");
    expect(url.pathname).toBe("/qr");
    expect(url.searchParams.get("name")).toBe("coffee");
    expect(url.searchParams.get("amount")).toBe("5");
  });

  test("skips undefined params while keeping defined ones", () => {
    expect(formatPath("/qr", { name: "test", amount: undefined })).toBe(
      "/qr?name=test",
    );
  });

  test("handles empty string param", () => {
    expect(formatPath("/auth/email", { email: "" })).toBe("/auth/email?email=");
  });
});

describe("afterparty paths", () => {
  test("provides the ticket availability endpoint", () => {
    expect(paths.afterpartyAvailability()).toBe("/afterparty/availability");
  });
});
