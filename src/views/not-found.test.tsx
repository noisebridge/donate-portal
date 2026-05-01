import { describe, expect, test } from "bun:test";
import { NotFoundPage } from "./not-found";

describe("NotFoundPage", () => {
  test("should contain 404 text", async () => {
    const result = await (
      <NotFoundPage isAuthenticated={false} csrfToken={undefined} />
    );

    expect(result).toContain("Page Not Found");
  });
});
