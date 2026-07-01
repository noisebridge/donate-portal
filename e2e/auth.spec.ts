import * as magicLinkManager from "~/managers/magic-link";
import { setAuthCookie } from "./auth-utils";
import { expect, test } from "./fixtures";

test.describe("Auth Flow Tests", () => {
  test("GitHub OAuth button redirects to GitHub authorization page", async ({
    page,
  }) => {
    await page.goto("/auth");

    // Click the GitHub OAuth button
    await page.click('a.btn-outline:has-text("GitHub")');

    // Should redirect to GitHub OAuth authorization page
    await expect(page).toHaveURL(/^https:\/\/github\.com\/login/);

    // Verify OAuth parameters are present in the URL
    const url = new URL(page.url());
    expect(url.searchParams.has("client_id")).toBe(true);
  });

  test("Google OAuth button redirects to Google authorization page", async ({
    page,
  }) => {
    await page.goto("/auth");

    // Click the Google OAuth button
    await page.click('a.btn-outline:has-text("Google")');

    // Should redirect to Google OAuth authorization page
    await expect(page).toHaveURL(/^https:\/\/accounts\.google\.com\//);

    // Verify OAuth parameters are present in the URL
    const url = new URL(page.url());
    expect(url.searchParams.has("client_id")).toBe(true);
  });

  test("Magic link authentication flow", async ({ page }) => {
    const testEmail = "test@example.com";

    // Generate a magic link using the manager
    const magicLinkUrl = magicLinkManager.generateUrl(testEmail);

    // Navigate to the magic link
    await page.goto(magicLinkUrl);

    // Should redirect to the subscription mangement page
    await expect(page).toHaveURL(/\/manage/);
  });

  test("Signout flow clears authentication", async ({ page }) => {
    const testEmail = "signout-test@example.com";

    // Set auth cookie and navigate to manage page
    await setAuthCookie(page.context(), testEmail, "magic_link");
    await page.goto("/manage", { waitUntil: "networkidle" });

    // Verify authenticated (on /manage page)
    await expect(page).toHaveURL(/\/manage/);

    // Click the Sign Out button
    await page.locator('.sign-out-form button[type="submit"]').click();

    // Verify redirected to home page
    await expect(page).toHaveURL("/");

    // Navigate to /manage to verify no longer authenticated
    await page.goto("/manage");

    // Should redirect to home page (not authenticated anymore)
    await expect(page).toHaveURL("/");
  });
});
