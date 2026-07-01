import * as donationManager from "~/managers/donation";
import { expect, test } from "./fixtures";
import {
  fillStripePaymentElement,
  getExpiryOneYearFromNow,
  waitForCheckoutModal,
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

    // Should open the Stripe checkout modal
    await waitForCheckoutModal(page);
  });
});

test.describe("Donation Flow Tests", () => {
  test("Amount $10 button creates Stripe checkout and redirects to /thank-you", async ({
    page,
  }) => {
    test.setTimeout(60000);

    await page.goto("/");

    // Click the $10 amount button
    await page.click('label[for="amount-10"]');

    // Submit the form
    await page.click("#donate-now");

    // Should open the Stripe checkout modal
    await waitForCheckoutModal(page);

    // Fill out the Stripe Payment Element with test card
    await fillStripePaymentElement(page, {
      cardNumber: "4242424242424242",
      expiry: getExpiryOneYearFromNow(),
      cvc: "123",
      zip: "94110",
    });

    // Submit payment
    await page.click("#payment-submit");

    // Wait for redirect to complete (Stripe processes payment and redirects)
    await page.waitForURL(/\/thank-you/, { timeout: 45000 });

    // Should redirect to thank-you page after successful payment
    await expect(page).toHaveURL(/\/thank-you/);
  });

  test("Custom amount $13.37 creates Stripe checkout and redirects to /thank-you", async ({
    page,
  }) => {
    test.setTimeout(60000);

    await page.goto("/");

    // Click the Custom amount button
    await page.click('label[for="amount-custom"]');

    // Fill in custom amount
    await page.fill('input[name="custom-amount"]', "13.37");

    // Submit the form
    await page.click("#donate-now");

    // Should open the Stripe checkout modal
    await waitForCheckoutModal(page);

    // Fill out the Stripe Payment Element with test card
    await fillStripePaymentElement(page, {
      cardNumber: "4242424242424242",
      expiry: getExpiryOneYearFromNow(),
      cvc: "123",
      zip: "94110",
    });

    // Submit payment
    await page.click("#payment-submit");

    // Wait for redirect to complete (Stripe processes payment and redirects)
    await page.waitForURL(/\/thank-you/, { timeout: 45000 });

    // Should redirect to thank-you page after successful payment
    await expect(page).toHaveURL(/\/thank-you/);
  });
});

test.describe("QR Donation Endpoint", () => {
  test("displays donation page with slider and opens checkout modal on submit", async ({
    page,
  }) => {
    await page.goto(
      "/qr?amount=5.00&name=Test%20Donation&description=Test%20Description",
    );

    // Verify the name and description are pre-filled on the QR donation page
    await expect(page.locator("#name")).toHaveValue("Test Donation");
    await expect(page.locator("#description")).toHaveValue("Test Description");

    // Verify the amount is displayed
    await expect(page.locator("#amount-input")).toHaveValue("5.00");

    // Verify the slider is present with correct values
    const slider = page.locator("#amount-slider");
    await expect(slider).toBeVisible();
    await expect(slider).toHaveAttribute("min", "2");
    await expect(slider).toHaveAttribute("max", "10");
    await expect(slider).toHaveValue("5");

    // Click the Donate button
    await page.click('button:has-text("Donate")');

    // Should open the Stripe checkout modal
    await waitForCheckoutModal(page);
  });

  test("slider updates displayed amount", async ({ page }) => {
    await page.goto("/qr?amount=10.00");

    // Verify initial amount
    await expect(page.locator("#amount-input")).toHaveValue("10.00");

    // Move the slider to a different value
    const slider = page.locator("#amount-slider");
    await slider.fill("15");

    // Verify the displayed amount updated
    await expect(page.locator("#amount-input")).toHaveValue("15.00");

    // Click the Donate button
    await page.click('button:has-text("Donate")');

    // Should open the Stripe checkout modal
    await waitForCheckoutModal(page);
  });

  test("returns 400 when name exceeds max length", async ({ page }) => {
    const longName = "a".repeat(donationManager.MAX_NAME_LENGTH + 1);
    const response = await page.goto(`/qr?amount=5.00&name=${longName}`);

    expect(response?.status()).toBe(400);
  });

  test("returns 400 when description exceeds max length", async ({ page }) => {
    const longDescription = "a".repeat(
      donationManager.MAX_DESCRIPTION_LENGTH + 1,
    );
    const response = await page.goto(
      `/qr?amount=5.00&description=${longDescription}`,
    );

    expect(response?.status()).toBe(400);
  });

  test("general donation link is visible and links to index donate section", async ({
    page,
  }) => {
    await page.goto("/qr?name=3D+Printing&amount=5.00");

    // Verify the name is pre-filled on the page
    await expect(page.locator("#name")).toHaveValue("3D Printing");
    const generalDonateLink = page.locator(
      'a:has-text("Make a general donation")',
    );
    await expect(generalDonateLink).toBeVisible();
    await expect(generalDonateLink).toHaveAttribute("href", "/#donate");

    await generalDonateLink.click();

    await expect(page).toHaveURL("/#donate");
  });

  test("redirects to index with error for invalid amount", async ({ page }) => {
    await page.goto("/qr?amount=invalid");

    // Should redirect to index with error message
    await expect(page).toHaveURL(/\/\?error=/);
  });
});

test.describe("QR Amount Controls", () => {
  test("editing the amount input updates the button text and slider", async ({
    page,
  }) => {
    await page.goto("/qr?amount=10.00");

    const amountInput = page.locator("#amount-input");
    const slider = page.locator("#amount-slider");
    const donateLabel = page.locator("#donate-label");

    // Type a new amount and blur to commit the change.
    await amountInput.fill("15");
    await amountInput.blur();

    // The input is normalized, and the button text and slider follow it.
    await expect(amountInput).toHaveValue("15.00");
    await expect(donateLabel).toHaveText("Donate · $15.00");
    await expect(slider).toHaveValue("15");
  });

  test("clicking a slider tick updates the input, slider, and button text", async ({
    page,
  }) => {
    await page.goto("/qr?amount=10.00");

    const amountInput = page.locator("#amount-input");
    const slider = page.locator("#amount-slider");
    const donateLabel = page.locator("#donate-label");

    // The minimum preset tick ($2) is rendered alongside the initial and max
    // presets. Clicking it jumps the amount down to that value.
    await page.click('#slider-ticks .tick[data-amt="2"]');

    await expect(amountInput).toHaveValue("2.00");
    await expect(slider).toHaveValue("2");
    await expect(donateLabel).toHaveText("Donate · $2.00");
  });

  test("moving the slider updates the button text and input", async ({
    page,
  }) => {
    await page.goto("/qr?amount=10.00");

    const amountInput = page.locator("#amount-input");
    const slider = page.locator("#amount-slider");
    const donateLabel = page.locator("#donate-label");

    await slider.fill("7");

    await expect(slider).toHaveValue("7");
    await expect(amountInput).toHaveValue("7.00");
    await expect(donateLabel).toHaveText("Donate · $7.00");
  });
});

test.describe("QR Custom Donation", () => {
  test("name and description are read-only until the Custom toggle is on", async ({
    page,
  }) => {
    await page.goto("/qr?amount=5&name=Laser%20Cutter&description=Shop%20fee");

    // Fields are pre-filled and locked by default
    await expect(page.locator("#name")).toHaveValue("Laser Cutter");
    await expect(page.locator("#description")).toHaveValue("Shop fee");
    await expect(page.locator("#name")).toHaveAttribute("readonly", "");
    await expect(page.locator("#description")).toHaveAttribute("readonly", "");

    // Enabling the Custom toggle unlocks editing
    await page.click('label:has-text("Custom")');
    await expect(page.locator("#name")).not.toHaveAttribute("readonly", "");
    await expect(page.locator("#description")).not.toHaveAttribute(
      "readonly",
      "",
    );
  });

  test("custom input values open checkout modal on submit", async ({
    page,
  }) => {
    await page.goto("/qr?amount=5");

    // Unlock editing and fill in custom values
    await page.click('label:has-text("Custom")');
    await page.fill("#name", "Soldering Workshop");
    await page.fill("#description", "Weekend class");
    await page.fill("#amount-input", "42");

    // Submit the form
    await page.click('button:has-text("Donate")');

    // Should open the Stripe checkout modal
    await waitForCheckoutModal(page);
  });
});
