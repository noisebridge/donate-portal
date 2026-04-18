import { expect, test } from "./fixtures";

test.describe("Navigation Tests", () => {
  test("Sign In button navigates to /auth", async ({ page }) => {
    await page.goto("/");
    await page.click('a:has-text("Sign In")');
    await expect(page).toHaveURL("/auth");
  });

  test("Become a supporting member button navigates to /auth when not authenticated", async ({
    page,
  }) => {
    await page.goto("/");
    await page.click('a:has-text("Become a supporting member")');
    await expect(page).toHaveURL("/auth");
  });

  test("404 page is displayed for non-existent routes", async ({ page }) => {
    const response = await page.goto("/nonexistent-page");

    // Verify 404 status code
    expect(response?.status()).toBe(404);

    // Verify 404 page content is displayed
    await expect(page.locator("h1")).toContainText("page_not_found");
  });

  test("Logo navigates to home page", async ({ page }) => {
    // Start on auth page
    await page.goto("/auth");

    // Click the logo/brand link
    await page.click("a.brand");

    // Should navigate to home page
    await expect(page).toHaveURL("/");
  });
});
