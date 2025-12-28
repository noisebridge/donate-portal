import { describe, expect, test } from "bun:test";
// biome-ignore lint/correctness/noUnusedImports: Html is used by JSX
import Html from "@kitajs/html";
import { IndexPage } from "./index";

describe("IndexPage", () => {
  test("should render", async () => {
    const result = await (<IndexPage isAuthenticated={false} />);

    expect(result).toBeTypeOf("string");
    expect(result.length).toBeGreaterThan(0);
  });

  test("should display error notification when provided", async () => {
    const errorMessage = "Something went wrong";
    const result = await (
      <IndexPage
        isAuthenticated={false}
        notifications={[{ type: "error", message: errorMessage }]}
      />
    );

    expect(result).toBeTypeOf("string");
    expect(result).toContain(errorMessage);
    expect(result).toContain('class="notification notification-error"');
  });

  test("should not display notification when no notifications provided", async () => {
    const result = await (<IndexPage isAuthenticated={false} />);

    expect(result).toBeTypeOf("string");
    expect(result).not.toContain('class="notification ');
  });
});
