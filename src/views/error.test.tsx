import { describe, expect, test } from "bun:test";
import { ErrorPage } from "./error";

describe("ErrorPage", () => {
  test("should render error page", async () => {
    const error = new Error("Test error message");
    const result = await (<ErrorPage error={error} isAuthenticated />);

    expect(result).toBeTypeOf("string");
    expect(result).toContain("Oops! Something went wrong");
  });
});
