import { describe, expect, test } from "bun:test";
import { AuthEmailPage } from "./email";

describe("AuthEmailPage", () => {
  test("should display provided email address", () => {
    const email = "user@example.com";
    const result = String(
      <AuthEmailPage
        email={email}
        isAuthenticated={false}
        csrfToken={undefined}
      />,
    );

    expect(result).toContain(email);
  });
});
