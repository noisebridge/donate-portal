import { describe, expect, test } from "bun:test";
import { Navbar } from "./navbar";

describe("Navbar", () => {
  test("when not authenticated: shows 'Sign In' link", () => {
    const result = String(
      <Navbar isAuthenticated={false} csrfToken={undefined} />,
    );

    expect(result).toContain('href="/auth"');
  });

  test("when not authenticated: does not show 'Manage' link", () => {
    const result = String(
      <Navbar isAuthenticated={false} csrfToken={undefined} />,
    );

    expect(result).not.toContain('href="/manage"');
  });

  test("when not authenticated: does not show 'Sign Out' button", () => {
    const result = String(
      <Navbar isAuthenticated={false} csrfToken={undefined} />,
    );

    expect(result).not.toContain('action="/auth/signout"');
  });

  test("when authenticated: shows 'Manage' link", () => {
    const result = String(
      <Navbar isAuthenticated={true} csrfToken={undefined} />,
    );

    expect(result).toContain('href="/manage"');
  });

  test("when authenticated: shows 'Sign Out' form", () => {
    const result = String(
      <Navbar isAuthenticated={true} csrfToken={undefined} />,
    );

    expect(result).toContain('action="/auth/signout"');
    expect(result).toContain('method="POST"');
  });
});
