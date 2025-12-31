import { expect, test } from "@playwright/test";
import {
  fillStripeCheckoutForm,
  getExpiryOneYearFromNow,
} from "./stripe-utils";

test.describe("Donation Validation Tests", () => {
  test("Custom amount below $2 shows error", async ({ page }) => {
    await page.goto("/");

    // Click the Custom amount button
    await page.click('label[for="amount-custom"]');

    // Fill in custom amount below minimum ($2.00)
    await page.fill('input[name="custom-amount"]', "1.50");

    // Submit the form
    await page.click("#donate-now");

    // Should stay on the same page with an error message (URL will have query params)
    expect(page.url()).toMatch(/^http:\/\/127\.0\.0\.1:3000\/\?/);
    await expect(page.locator(".message-error")).toBeVisible();
    await expect(page.locator(".message-error")).toContainText(
      "valid donation amount",
    );
  });

  test("Custom amount of exactly $2 is accepted", async ({ page }) => {
    await page.goto("/");

    // Click the Custom amount button
    await page.click('label[for="amount-custom"]');

    // Fill in exactly the minimum amount
    await page.fill('input[name="custom-amount"]', "2.00");

    // Submit the form
    await page.click("#donate-now");

    // Should redirect to Stripe checkout
    await expect(page).toHaveURL(/checkout\.stripe\.com/);

    // Expect page to contain "$2.00" on it
    await expect(page.getByText("$2.00")).toBeVisible();
  });
});

test.describe("Donation Flow Tests", () => {
  test("Amount $10 button creates Stripe checkout and redirects to /thank-you", async ({
    page,
  }) => {
    await page.goto("/");

    // Click the $10 amount button
    await page.click('label[for="amount-10"]');

    // Submit the form
    await page.click("#donate-now");

    // Should redirect to Stripe checkout
    await expect(page).toHaveURL(/checkout\.stripe\.com/);

    // Expect page to contain "$10.00" on it
    await expect(page.getByText("$10.00")).toBeVisible();

    // Fill out the Stripe checkout form with test card
    await fillStripeCheckoutForm(page, {
      email: "test@example.com",
      cardNumber: "4242424242424242",
      expiry: getExpiryOneYearFromNow(),
      cvc: "123",
      name: "Test User",
      zip: "94110",
    });

    // Submit payment
    await page.click('button:has-text("Pay")');

    // Wait for redirect to complete (Stripe processes payment and redirects)
    await page.waitForTimeout(5000);
    await page.waitForLoadState("networkidle");

    // Should redirect to thank-you page after successful payment
    await expect(page).toHaveURL(/\/thank-you/);
  });

  test("Custom amount $13.37 creates Stripe checkout and redirects to /thank-you", async ({
    page,
  }) => {
    await page.goto("/");

    // Click the Custom amount button
    await page.click('label[for="amount-custom"]');

    // Fill in custom amount
    await page.fill('input[name="custom-amount"]', "13.37");

    // Submit the form
    await page.click("#donate-now");

    // Should redirect to Stripe checkout
    await expect(page).toHaveURL(/checkout\.stripe\.com/);

    // Expect page to contain "$13.37" on it
    await expect(page.getByText("$13.37")).toBeVisible();

    // Fill out the Stripe checkout form with test card
    await fillStripeCheckoutForm(page, {
      email: "test@example.com",
      cardNumber: "4242424242424242",
      expiry: getExpiryOneYearFromNow(),
      cvc: "123",
      name: "Test User",
      zip: "94110",
    });

    // Submit payment
    await page.click('button:has-text("Pay")');

    // Wait for redirect to complete (Stripe processes payment and redirects)
    await page.waitForTimeout(5000);
    await page.waitForLoadState("networkidle");

    // Should redirect to thank-you page after successful payment
    await expect(page).toHaveURL(/\/thank-you/);
  });
});
