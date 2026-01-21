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

    // Get the custom amount input
    const customAmountInput = page.locator('input[name="custom-amount"]');

    // Try to submit the form
    await page.click("#donate-now");

    // Form should not navigate (client-side validation blocks it)
    expect(page.url()).toMatch(/^http:\/\/127\.0\.0\.1:3000\/$/);

    // Check that the input has a custom validity message set
    const validationMessage = await customAmountInput.evaluate(
      (el) => el.validationMessage,
    );
    expect(validationMessage).toContain("below the minimum");
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

test.describe("QR Donation Endpoint", () => {
  test("displays donation page with slider and redirects to Stripe on submit", async ({
    page,
  }) => {
    await page.goto(
      "/qr?amount=5.00&name=Test%20Donation&description=Test%20Description",
    );

    // Verify the name and description appear on the QR donation page
    await expect(page.locator("text=Test Donation")).toBeVisible();
    await expect(page.locator("text=Test Description")).toBeVisible();

    // Verify the amount is displayed
    await expect(page.locator("#current-amount")).toHaveText("$5.00");

    // Verify the slider is present with correct values
    const slider = page.locator("#amount-slider");
    await expect(slider).toBeVisible();
    await expect(slider).toHaveAttribute("min", "2");
    await expect(slider).toHaveAttribute("max", "10");
    await expect(slider).toHaveValue("5");

    // Click the Donate button
    await page.click('button:has-text("Donate")');

    // Should redirect to Stripe checkout
    await expect(page).toHaveURL(/checkout\.stripe\.com/);

    // Verify the amount appears on the Stripe checkout page
    await expect(page.getByText("$5.00")).toBeVisible();
  });

  test("slider updates displayed amount", async ({ page }) => {
    await page.goto("/qr?amount=10.00");

    // Verify initial amount
    await expect(page.locator("#current-amount")).toHaveText("$10.00");

    // Move the slider to a different value
    const slider = page.locator("#amount-slider");
    await slider.fill("15");

    // Verify the displayed amount updated
    await expect(page.locator("#current-amount")).toHaveText("$15.00");

    // Click the Donate button
    await page.click('button:has-text("Donate")');

    // Should redirect to Stripe checkout with new amount
    await expect(page).toHaveURL(/checkout\.stripe\.com/);
    await expect(page.getByText("$15.00")).toBeVisible();
  });

  test("redirects to index with error for invalid amount", async ({ page }) => {
    await page.goto("/qr?amount=invalid");

    // Should redirect to index with error message
    await expect(page).toHaveURL(/\/\?error=/);
  });
});
