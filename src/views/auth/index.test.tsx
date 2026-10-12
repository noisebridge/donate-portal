import { describe, expect, test } from "bun:test";
import { AuthPage } from "./index";

describe("AuthPage", () => {
  test("should display error message when provided", () => {
    const errorMessage = "Invalid credentials";
    const result = String(
      <AuthPage
        isAuthenticated={false}
        messages={[{ type: "error", text: errorMessage }]}
        csrfToken={undefined}
      />,
    );

    expect(result).toContain(errorMessage);
    expect(result).toContain('class="message message-error"');
  });
});
