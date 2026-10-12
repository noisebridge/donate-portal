import { describe, expect, test } from "bun:test";
import { MessageContainer } from "./message-container";

describe("MessageContainer", () => {
  test("empty messages array: renders nothing", () => {
    const result = String(<MessageContainer messages={[]} />);

    expect(result).toBe("");
  });

  test("single error message: renders with error styling", () => {
    const result = String(
      <MessageContainer
        messages={[{ type: "error", text: "Something went wrong" }]}
      />,
    );

    expect(result).toContain("Something went wrong");
    expect(result).toContain('class="message message-error"');
    expect(result).toContain('data-type="error"');
    expect(result).toContain('role="alert"');
  });

  test("single info message: renders with info styling", () => {
    const result = String(
      <MessageContainer
        messages={[{ type: "info", text: "Your changes have been saved" }]}
      />,
    );

    expect(result).toContain("Your changes have been saved");
    expect(result).toContain('class="message message-info"');
    expect(result).toContain('data-type="info"');
    expect(result).toContain('role="alert"');
  });

  test("multiple messages: all messages rendered", () => {
    const result = String(
      <MessageContainer
        messages={[
          { type: "error", text: "Error message one" },
          { type: "info", text: "Info message two" },
          { type: "error", text: "Error message three" },
        ]}
      />,
    );

    expect(result).toContain("Error message one");
    expect(result).toContain("Info message two");
    expect(result).toContain("Error message three");
    expect(result).toContain('class="message message-error"');
    expect(result).toContain('class="message message-info"');
  });

  test("message has dismiss button by default", () => {
    const result = String(
      <MessageContainer messages={[{ type: "info", text: "Dismissable" }]} />,
    );

    expect(result).toContain('class="message-dismiss"');
    expect(result).toContain('aria-label="Dismiss"');
  });

  test("message with dismissable=false has no dismiss button", () => {
    const result = String(
      <MessageContainer
        messages={[
          { type: "error", text: "Non-dismissable", dismissable: false },
        ]}
      />,
    );

    expect(result).toContain("Non-dismissable");
    expect(result).not.toContain('class="message-dismiss"');
  });
});
