import { describe, expect, test } from "bun:test";
// biome-ignore lint/correctness/noUnusedImports: Html is used by JSX
import Html from "@kitajs/html";
import { NotFoundPage } from "./not-found";

describe("NotFoundPage", () => {
  test("should render not found page", async () => {
    const result = await (<NotFoundPage isAuthenticated={false} />);

    expect(result).toBeTypeOf("string");
    expect(result.length).toBeGreaterThan(0);
  });

  test("should contain 404 text", async () => {
    const result = await (<NotFoundPage isAuthenticated={false} />);

    expect(result).toContain("Page Not Found");
  });
});
