import { describe, expect, test } from "bun:test";
import { ErrorPage } from "./error";

describe("ErrorPage", () => {
  test("should show error details", () => {
    const error = new Error("Test error message");
    const result = String(
      <ErrorPage error={error} isAuthenticated csrfToken={undefined} />,
    );

    expect(result).toContain("Test error message");
    expect(result).toContain("Stack trace");
  });
});
