import { describe, expect, test } from "bun:test";
// biome-ignore lint/correctness/noUnusedImports: Html is used by JSX
import Html from "@kitajs/html";
import { AuthPage } from "./index";

describe("AuthPage", () => {
  test("should render auth page", async () => {
    const result = await (<AuthPage isAuthenticated={false} />);

    expect(result).toBeTypeOf("string");
    expect(result.length).toBeGreaterThan(0);
  });

  test("should display error notification when provided", async () => {
    const errorMessage = "Invalid credentials";
    const result = await (
      <AuthPage
        isAuthenticated={false}
        notifications={[{ type: "error", message: errorMessage }]}
      />
    );

    expect(result).toBeTypeOf("string");
    expect(result).toContain(errorMessage);
    expect(result).toContain('class="notification notification-error"');
  });
});
