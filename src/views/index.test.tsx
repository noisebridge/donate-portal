import { describe, expect, test } from "bun:test";
import { IndexPage } from "./index";

describe("IndexPage", () => {
  test("should render", async () => {
    const result = await (<IndexPage isAuthenticated={false} />);

    expect(result).toBeTypeOf("string");
    expect(result.length).toBeGreaterThan(0);
  });

  test("should display error message when provided", async () => {
    const errorMessage = "Something went wrong";
    const result = await (
      <IndexPage
        isAuthenticated={false}
        messages={[{ type: "error", text: errorMessage }]}
      />
    );

    expect(result).toBeTypeOf("string");
    expect(result).toContain(errorMessage);
    expect(result).toContain('class="message message-error"');
  });

  test("should not display message when no messages provided", async () => {
    const result = await (<IndexPage isAuthenticated={false} />);

    expect(result).toBeTypeOf("string");
    expect(result).not.toContain('class="message ');
  });
});
