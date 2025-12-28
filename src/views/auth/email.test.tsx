import { describe, expect, test } from "bun:test";
import { AuthEmailPage } from "./email";

describe("AuthEmailPage", () => {
  test("should display provided email address", async () => {
    const email = "user@example.com";
    const result = await (
      <AuthEmailPage email={email} isAuthenticated={false} />
    );

    expect(result).toBeTypeOf("string");
    expect(result).toContain(email);
  });
});
