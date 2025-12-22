import { expect, test } from "@playwright/test";

test.describe("Navigation Tests", () => {
  test("Sign In button navigates to /auth", async ({ page }) => {
    await page.goto("/");
    await page.click('a:has-text("Sign In")');
    await expect(page).toHaveURL("/auth");
  });

  test("Start Membership Donation button navigates to /auth when not authenticated", async ({
    page,
  }) => {
    await page.goto("/");
    await page.click('a:has-text("Start Membership Donation")');
    await expect(page).toHaveURL("/auth");
  });
});
