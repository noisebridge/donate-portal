import { describe, expect, test } from "bun:test";
// biome-ignore lint/correctness/noUnusedImports: Html is used by JSX
import Html from "@kitajs/html";
import { ErrorPage } from "./error";

describe("ErrorPage", () => {
  test("should render error page", async () => {
    const error = new Error("Test error message");
    const result = await (<ErrorPage error={error} isAuthenticated />);

    expect(result).toBeTypeOf("string");
    expect(result).toContain("Oops! Something went wrong");
  });
});
