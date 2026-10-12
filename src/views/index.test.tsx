import { describe, expect, test } from "bun:test";
import { IndexPage } from "./index";

describe("IndexPage", () => {
  test("should display error message when provided", () => {
    const errorMessage = "Something went wrong";
    const result = String(
      <IndexPage
        isAuthenticated={false}
        messages={[{ type: "error", text: errorMessage }]}
        csrfToken={undefined}
      />,
    );

    expect(result).toContain(errorMessage);
    expect(result).toContain('class="message message-error"');
  });

  test("should not display message when no messages provided", () => {
    const result = String(
      <IndexPage isAuthenticated={false} csrfToken={undefined} />,
    );

    expect(result).not.toContain('class="message ');
  });
});
