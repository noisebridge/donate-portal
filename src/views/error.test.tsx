import { describe, expect, test } from "bun:test";
import { ErrorPage } from "./error";

describe("ErrorPage", () => {
  test("should show error details", async () => {
    const error = new Error("Test error message");
    const result = await (
      <ErrorPage error={error} isAuthenticated csrfToken={undefined} />
    );

    expect(result).toContain("Test error message");
    expect(result).toContain("Stack trace");
  });
});
