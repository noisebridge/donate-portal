import { describe, expect, test } from "bun:test";
import { Navbar } from "./navbar";

describe("Navbar", () => {
  test("when not authenticated: shows 'Sign In' link", async () => {
    const result = await (<Navbar isAuthenticated={false} />);

    expect(result).toBeTypeOf("string");
    expect(result).toContain('href="/auth"');
  });

  test("when not authenticated: does not show 'Manage' link", async () => {
    const result = await (<Navbar isAuthenticated={false} />);

    expect(result).toBeTypeOf("string");
    expect(result).not.toContain('href="/manage"');
  });

  test("when not authenticated: does not show 'Sign Out' button", async () => {
    const result = await (<Navbar isAuthenticated={false} />);

    expect(result).toBeTypeOf("string");
    expect(result).not.toContain('action="/auth/signout"');
  });

  test("when authenticated: shows 'Manage' link", async () => {
    const result = await (<Navbar isAuthenticated={true} />);

    expect(result).toBeTypeOf("string");
    expect(result).toContain('href="/manage"');
  });

  test("when authenticated: shows 'Sign Out' form", async () => {
    const result = await (<Navbar isAuthenticated={true} />);

    expect(result).toBeTypeOf("string");
    expect(result).toContain('action="/auth/signout"');
    expect(result).toContain('method="post"');
  });
});
