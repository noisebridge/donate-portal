import { expect, test } from "@playwright/test";
import {
  fillStripeCheckoutForm,
  getExpiryOneYearFromNow,
} from "./stripe-utils";

/**
 * Generate a unique test email for each test invocation
 */
function generateTestEmail(): string {
  const randomHash = Math.random().toString(36).substring(2, 8);
  return `e2e-test-${randomHash}@testing.noisebridge.net`;
}

test.describe("Subscription Flow Tests", () => {
  test("Lowest tier subscription: sign up, verify on /manage, then cancel", async ({
    page,
  }) => {
    const testEmail = generateTestEmail();

    // Authenticate via backdoor and wait for redirect to /manage
    await page.goto(`/auth/backdoor?email=${encodeURIComponent(testEmail)}`, {
      waitUntil: "networkidle",
    });
    await expect(page).toHaveURL(/\/manage/);

    // Select the lowest tier (Starving Hacker - $50/month)
    await page.click('label[for="tier-starving"]');

    // Submit the subscription form
    await page.click(
      'button[type="submit"]:has-text("Start Monthly Donation")',
    );
    await page.waitForLoadState("networkidle");

    // Should redirect to Stripe checkout
    await expect(page).toHaveURL(/checkout\.stripe\.com/);

    // Expect page to contain "$50.00" on it (lowest tier amount)
    await expect(page.getByText("$50.00")).toBeVisible();

    // Fill out the Stripe checkout form with test card
    await fillStripeCheckoutForm(page, {
      cardNumber: "4242424242424242",
      expiry: getExpiryOneYearFromNow(),
      cvc: "123",
      name: "Test User",
      zip: "94110",
    });

    // Submit payment and wait for network to settle
    await page.click('button[type="submit"]:has-text("Subscribe")');
    await page.waitForTimeout(5000);
    await page.waitForLoadState("networkidle");

    // Should redirect back to /manage after successful subscription
    await expect(page).toHaveURL(/\/manage/);

    // Verify the lowest tier ($50) is selected on the manage page
    const starvingTierRadio = page.locator("input#tier-starving");
    await expect(starvingTierRadio).toBeChecked();

    // Cancel the subscription
    await page.dblclick(
      'button[type="submit"]:has-text("Cancel Monthly Donation")',
    );

    // Should still be on /manage after cancellation
    await expect(page).toHaveURL(/\/manage/);

    // Verify the cancel button is no longer visible (subscription cancelled)
    await expect(
      page.locator('button:has-text("Cancel Monthly Donation")'),
    ).not.toBeVisible();
  });

  test("Custom tier subscription: $1337/month, verify on /manage, then cancel", async ({
    page,
  }) => {
    const testEmail = generateTestEmail();

    // Authenticate via backdoor and wait for redirect to /manage
    await page.goto(`/auth/backdoor?email=${encodeURIComponent(testEmail)}`, {
      waitUntil: "networkidle",
    });
    await expect(page).toHaveURL(/\/manage/);

    // Select the custom tier option
    await page.click('label[for="tier-custom"]');

    // Fill in custom amount of $1337
    await page.fill("input#custom-amount", "1337");

    // Submit the subscription form
    await page.click(
      'button[type="submit"]:has-text("Start Monthly Donation")',
    );
    await page.waitForLoadState("networkidle");

    // Should redirect to Stripe checkout
    await expect(page).toHaveURL(/checkout\.stripe\.com/);

    // Expect page to contain "$1,337.00" on it (custom amount)
    await expect(page.getByText("$1,337.00")).toBeVisible();

    // Fill out the Stripe checkout form with test card
    await fillStripeCheckoutForm(page, {
      cardNumber: "4242424242424242",
      expiry: getExpiryOneYearFromNow(),
      cvc: "123",
      name: "Test User",
      zip: "94110",
    });

    // Submit payment and wait for network to settle
    await page.click('button[type="submit"]:has-text("Subscribe")');
    await page.waitForTimeout(5000);
    await page.waitForLoadState("networkidle");

    // Should redirect back to /manage after successful subscription
    await expect(page).toHaveURL(/\/manage/);

    // Verify the custom tier is selected and shows the correct amount
    const customTierRadio = page.locator("input#tier-custom");
    await expect(customTierRadio).toBeChecked();

    // Verify the custom amount input shows 1337.00
    const customAmountInput = page.locator("input#custom-amount");
    await expect(customAmountInput).toHaveValue("1337.00");

    // Cancel the subscription
    await page.dblclick(
      'button[type="submit"]:has-text("Cancel Monthly Donation")',
    );

    // Should still be on /manage after cancellation
    await expect(page).toHaveURL(/\/manage/);

    // Verify the cancel button is no longer visible (subscription cancelled)
    await expect(
      page.locator('button:has-text("Cancel Monthly Donation")'),
    ).not.toBeVisible();
  });

  test("Stripe portal can be accessed with active subscription", async ({
    page,
  }) => {
    const testEmail = generateTestEmail();

    // Authenticate via backdoor and wait for redirect to /manage
    await page.goto(`/auth/backdoor?email=${encodeURIComponent(testEmail)}`, {
      waitUntil: "networkidle",
    });
    await expect(page).toHaveURL(/\/manage/);

    // Select the employed tier (middle tier - $100/month)
    await page.click('label[for="tier-employed"]');

    // Submit the subscription form
    await page.click(
      'button[type="submit"]:has-text("Start Monthly Donation")',
    );
    await page.waitForLoadState("networkidle");

    // Should redirect to Stripe checkout
    await expect(page).toHaveURL(/checkout\.stripe\.com/);

    // Fill out the Stripe checkout form with test card
    await fillStripeCheckoutForm(page, {
      cardNumber: "4242424242424242",
      expiry: getExpiryOneYearFromNow(),
      cvc: "123",
      name: "Test User",
      zip: "94110",
    });

    // Submit payment and wait for network to settle
    await page.click('button[type="submit"]:has-text("Subscribe")');
    await page.waitForTimeout(5000);
    await page.waitForLoadState("networkidle");

    // Should redirect back to /manage after successful subscription
    await expect(page).toHaveURL(/\/manage/);

    // Verify the portal button is visible
    const portalButton = page.locator('a[href="/subscribe/portal"]');
    await expect(portalButton).toBeVisible();

    // Click the portal button
    await portalButton.click();
    await page.waitForLoadState("networkidle");

    // Should redirect to Stripe billing portal
    await expect(page).toHaveURL(/billing\.stripe\.com/);

    // Verify we're on the Stripe billing portal by checking for common elements
    // The portal should show subscription information
    await expect(page.getByText(/subscription/i).first()).toBeVisible({
      timeout: 10000,
    });
  });
});
