import { expect, test } from "@playwright/test";
import magicLinkManager from "~/managers/magic-link";

test.describe("Auth Flow Tests", () => {
  test("GitHub OAuth button redirects to GitHub authorization page", async ({
    page,
  }) => {
    await page.goto("/auth");

    // Click the GitHub OAuth button
    await page.click('a.btn-github:has-text("Continue with GitHub")');

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
    await page.click('a.btn-google:has-text("Continue with Google")');

    // Should redirect to Google OAuth authorization page
    await expect(page).toHaveURL(/^https:\/\/accounts\.google\.com\//);

    // Verify OAuth parameters are present in the URL
    const url = new URL(page.url());
    expect(url.searchParams.has("client_id")).toBe(true);
  });

  test("Magic link authentication flow", async ({ page }) => {
    const testEmail = "test@example.com";

    // Generate a magic link using the manager
    const magicLinkUrl = magicLinkManager.generateMagicLinkUrl(testEmail);

    // Navigate to the magic link
    await page.goto(magicLinkUrl);

    // Should redirect to the subscription mangement page
    await expect(page).toHaveURL(/\/manage/);
  });
});
