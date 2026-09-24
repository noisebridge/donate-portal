import { describe, expect, test } from "bun:test";
import { FriendlyError } from "~/lib/friendly-error";
import { FriendlyErrorPage } from "./friendly-error";

describe("FriendlyErrorPage", () => {
  test("shows the escaped title and description without a stack trace", async () => {
    const error = new FriendlyError("Title <b>", "Description & more");
    const result = await (
      <FriendlyErrorPage error={error} isAuthenticated csrfToken={undefined} />
    );

    expect(result).toContain("Title &lt;b&gt;");
    expect(result).toContain("Description &amp; more");
    expect(result).not.toContain("Stack trace");
  });
});
