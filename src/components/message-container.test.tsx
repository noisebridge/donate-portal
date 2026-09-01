import { describe, expect, test } from "bun:test";
import { MessageContainer } from "./message-container";

describe("MessageContainer", () => {
  test("empty messages array: renders nothing", async () => {
    const result = await (<MessageContainer messages={[]} />);

    // Should return null/empty for no messages
    expect(result).toBeNull();
  });

  test("single error message: renders with error styling", async () => {
    const result = await (
      <MessageContainer
        messages={[{ type: "error", text: "Something went wrong" }]}
      />
    );

    expect(result).toBeTypeOf("string");
    expect(result).toContain("Something went wrong");
    expect(result).toContain('class="message message-error"');
    expect(result).toContain('data-type="error"');
    expect(result).toContain('role="alert"');
  });

  test("single info message: renders with info styling", async () => {
    const result = await (
      <MessageContainer
        messages={[{ type: "info", text: "Your changes have been saved" }]}
      />
    );

    expect(result).toBeTypeOf("string");
    expect(result).toContain("Your changes have been saved");
    expect(result).toContain('class="message message-info"');
    expect(result).toContain('data-type="info"');
    expect(result).toContain('role="alert"');
  });

  test("multiple messages: all messages rendered", async () => {
    const result = await (
      <MessageContainer
        messages={[
          { type: "error", text: "Error message one" },
          { type: "info", text: "Info message two" },
          { type: "error", text: "Error message three" },
        ]}
      />
    );

    expect(result).toBeTypeOf("string");
    expect(result).toContain("Error message one");
    expect(result).toContain("Info message two");
    expect(result).toContain("Error message three");
    expect(result).toContain('class="message message-error"');
    expect(result).toContain('class="message message-info"');
  });

  test("message has dismiss button by default", async () => {
    const result = await (
      <MessageContainer messages={[{ type: "info", text: "Dismissable" }]} />
    );

    expect(result).toBeTypeOf("string");
    expect(result).toContain('class="message-dismiss"');
    expect(result).toContain('aria-label="Dismiss"');
  });

  test("message with dismissable=false has no dismiss button", async () => {
    const result = await (
      <MessageContainer
        messages={[
          { type: "error", text: "Non-dismissable", dismissable: false },
        ]}
      />
    );

    expect(result).toBeTypeOf("string");
    expect(result).toContain("Non-dismissable");
    expect(result).not.toContain('class="message-dismiss"');
  });
});
