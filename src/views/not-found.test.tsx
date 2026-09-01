import { describe, expect, test } from "bun:test";
import { NotFoundPage } from "./not-found";

// Smoke test. The string assertions are secondary — what is under test is that
// the page renders at all: the JSX evaluates, the Layout wrapper applies, and
// the props are accepted. This is the only coverage NotFoundPage has, so it is
// deliberately kept even though the component has no branches.
describe("NotFoundPage", () => {
  test("renders a complete page without throwing", async () => {
    const result = await (
      <NotFoundPage isAuthenticated={false} csrfToken={undefined} />
    );

    expect(result).toContain("<!DOCTYPE html>");
    expect(result).toContain("Page Not Found");
  });
});
