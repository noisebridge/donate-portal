import config from "~/config";
import { expect, test } from "./fixtures";
import {
  fillStripeCheckoutForm,
  getExpiryOneYearFromNow,
} from "./stripe-utils";

test.describe
  .serial("Alerts Page Tests", () => {
    test.use({
      httpCredentials: {
        username: config.alertsUsername,
        password: config.alertsPassword,
      },
    });

    test.beforeAll(async ({ browser }) => {
      const context = await browser.newContext();
      const page = await context.newPage();

      // Donation 1: $10 via standard button
      await page.goto("/");
      await page.click('label[for="amount-10"]');
      await page.click("#donate-now");
      await expect(page).toHaveURL(/checkout\.stripe\.com/);
      await fillStripeCheckoutForm(page, {
        email: "alerts-test@example.com",
        cardNumber: "4242424242424242",
        expiry: getExpiryOneYearFromNow(),
        cvc: "123",
        name: "Alerts Test User",
        zip: "94110",
      });
      await page.click('button:has-text("Pay")');
      await page.waitForTimeout(5000);
      await page.waitForLoadState("networkidle");
      await expect(page).toHaveURL(/\/thank-you/);

      // Donation 2: $4.69 custom amount (triggers NICE badge)
      await page.goto("/");
      await page.click('label[for="amount-custom"]');
      await page.fill('input[name="custom-amount"]', "4.69");
      await page.click("#donate-now");
      await expect(page).toHaveURL(/checkout\.stripe\.com/);
      await fillStripeCheckoutForm(page, {
        email: "alerts-test@example.com",
        cardNumber: "4242424242424242",
        expiry: getExpiryOneYearFromNow(),
        cvc: "123",
        name: "Alerts Test User",
        zip: "94110",
      });
      await page.click('button:has-text("Pay")');
      await page.waitForTimeout(5000);
      await page.waitForLoadState("networkidle");
      await expect(page).toHaveURL(/\/thank-you/);

      await context.close();
    });

    test("alerts page loads and shows donations", async ({ page }) => {
      const response = await page.goto("/alerts");
      expect(response?.status()).toBe(200);

      await expect(page.locator("text=Latest Donation")).toBeVisible();
      await expect(page.locator(".history-list")).toBeVisible();
    });

    test("latest donation shows correct amount and product name", async ({
      page,
    }) => {
      await page.goto("/alerts");

      // The most recent donation ($4.69) should be the latest
      await expect(page.locator("#alert-amount")).toContainText("$4.69");
      await expect(page.locator("#alert-product")).toHaveText(
        "General Donation",
      );
    });

    test("displays the NICE badge for $X.69 amounts", async ({ page }) => {
      await page.goto("/alerts");
      await expect(page.locator(".nice-badge").first()).toBeVisible();
    });

    test("$10 donation appears in history with correct name", async ({
      page,
    }) => {
      await page.goto("/alerts");

      // The $10 donation should be in the history list
      const historyItem = page.locator('.history-item[data-amount="1000"]');
      await expect(historyItem.first()).toBeVisible();
      await expect(historyItem.first().locator(".history-product")).toHaveText(
        "General Donation",
      );
    });
  });

test("Alerts page returns 401 without credentials", async ({ browserType }) => {
  const browser = await browserType.launch();
  const page = await browser.newPage();

  const response = await page.goto("/alerts");
  expect(response?.status()).toBe(401);

  await browser.close();
});
