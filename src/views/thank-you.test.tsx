import { describe, expect, test } from "bun:test";
import { ThankYouPage } from "./thank-you";

describe("ThankYouPage", () => {
  test("should render thank you page", async () => {
    const result = await (<ThankYouPage isAuthenticated={false} />);

    expect(result).toBeTypeOf("string");
    expect(result.length).toBeGreaterThan(0);
  });
});
