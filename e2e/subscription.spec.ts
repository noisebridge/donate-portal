import { expect, type Page, test } from "@playwright/test";
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

/**
 * Login via backdoor and navigate to /manage
 */
async function loginViaBackdoor(page: Page, email: string): Promise<void> {
  // Start navigation to backdoor
  await page.goto(`/auth/backdoor?email=${encodeURIComponent(email)}`);

  // Explicitly wait for URL to contain /manage (the redirect target)
  try {
    await page.waitForURL(/\/manage/, { timeout: 10000 });
  } catch (_error) {
    // If timeout, throw a more helpful error with current URL
    throw new Error(
      `Backdoor did not redirect to /manage. Current URL: ${page.url()}`,
    );
  }

  // Wait for page to be fully loaded
  await page.waitForLoadState("networkidle");
}

/**
 * Create a subscription by selecting a tier and completing Stripe checkout
 */
async function createSubscription(
  page: Page,
  tierSelector: string,
): Promise<void> {
  await page.click(tierSelector);
  await page.click('button:has-text("Start Monthly Donation")');

  // Wait for redirect to Stripe checkout
  await page.waitForURL(/checkout\.stripe\.com/, { timeout: 10000 });

  await fillStripeCheckoutForm(page, {
    cardNumber: "4242424242424242",
    expiry: getExpiryOneYearFromNow(),
    cvc: "123",
    name: "Test User",
    zip: "94110",
  });

  await page.click('button:has-text("Subscribe")');

  // Wait for redirect back to /manage after successful payment
  await page.waitForURL(/\/manage/, { timeout: 15000 });
  await page.waitForLoadState("networkidle");

  // Give extra time for subscription state to sync
  await page.waitForTimeout(2000);
}

/**
 * Cancel the current subscription
 */
async function cancelSubscription(page: Page): Promise<void> {
  await page.dblclick('button:has-text("Cancel Monthly Donation")');
  await expect(
    page.locator('button:has-text("Cancel Monthly Donation")'),
  ).not.toBeVisible();
}

test.describe("Subscription Flow Tests", () => {
  test("Lowest tier subscription: sign up, verify on /manage, then cancel", async ({
    page,
  }) => {
    await loginViaBackdoor(page, generateTestEmail());
    await createSubscription(page, 'label[for="tier-starving"]');

    // Verify the lowest tier ($50) is selected on the manage page
    await expect(page.locator("input#tier-starving")).toBeChecked();

    await cancelSubscription(page);
  });

  test("Custom tier subscription: $1337/month, verify on /manage, then cancel", async ({
    page,
  }) => {
    await loginViaBackdoor(page, generateTestEmail());

    // Select the custom tier and fill in amount
    await page.click('label[for="tier-custom"]');
    await page.fill("input#custom-amount", "1337");

    await page.click('button:has-text("Start Monthly Donation")');
    await page.waitForLoadState("networkidle");

    await expect(page).toHaveURL(/checkout\.stripe\.com/);
    await expect(page.getByText("$1,337.00")).toBeVisible();

    await fillStripeCheckoutForm(page, {
      cardNumber: "4242424242424242",
      expiry: getExpiryOneYearFromNow(),
      cvc: "123",
      name: "Test User",
      zip: "94110",
    });

    await page.click('button:has-text("Subscribe")');
    await page.waitForTimeout(5000);
    await page.waitForLoadState("networkidle");

    await expect(page).toHaveURL(/\/manage/);

    // Verify the custom tier is selected and shows the correct amount
    await expect(page.locator("input#tier-custom")).toBeChecked();
    await expect(page.locator("input#custom-amount")).toHaveValue("1337.00");

    await cancelSubscription(page);
  });

  test("Stripe portal can be accessed with active subscription", async ({
    page,
  }) => {
    await loginViaBackdoor(page, generateTestEmail());
    await createSubscription(page, 'label[for="tier-employed"]');

    // Verify the portal button is visible and click it
    const portalButton = page.locator('a[href="/subscribe/portal"]');
    await expect(portalButton).toBeVisible();
    await portalButton.click();

    // Wait for redirect to Stripe billing portal
    await page.waitForURL(/billing\.stripe\.com/, { timeout: 10000 });
    await expect(page).toHaveURL(/billing\.stripe\.com/);
    await expect(page.getByText(/subscription/i).first()).toBeVisible({
      timeout: 10000,
    });
  });

  test("Subscription update: change from $50 to $100 tier", async ({
    page,
  }) => {
    await loginViaBackdoor(page, generateTestEmail());
    await createSubscription(page, 'label[for="tier-starving"]');

    // Verify the lowest tier ($50) is selected (radio inputs are typically hidden via CSS)
    await expect(page.locator("input#tier-starving")).toBeChecked();

    // Update to the $100 tier
    await page.click('label[for="tier-employed"]');
    await page.click('button:has-text("Update Monthly Donation")');

    // Wait for redirect back to /manage
    await page.waitForURL(/\/manage/, { timeout: 10000 });
    await page.waitForLoadState("networkidle");

    // Should stay on /manage (no checkout for updates)
    await expect(page).toHaveURL(/\/manage/);
    await expect(page.locator("input#tier-employed")).toBeChecked();

    await cancelSubscription(page);
  });

  test("Same amount rejection: cannot update to same tier", async ({
    page,
  }) => {
    await loginViaBackdoor(page, generateTestEmail());
    await createSubscription(page, 'label[for="tier-starving"]');

    // Try to "update" to the same $50 tier
    await page.click('label[for="tier-starving"]');
    await page.click('button:has-text("Update Monthly Donation")');
    await page.waitForLoadState("networkidle");

    // Should stay on /manage with an error message about same amount
    await expect(page).toHaveURL(/\/manage/);
    await expect(page.locator(".message-error")).toBeVisible();
    await expect(page.locator(".message-error")).toContainText(
      "different donation amount",
    );

    await cancelSubscription(page);
  });

  test("Manage page without subscription shows tier selector but no cancel button", async ({
    page,
  }) => {
    await loginViaBackdoor(page, generateTestEmail());

    // Verify no cancel button is present
    await expect(
      page.locator('button:has-text("Cancel Monthly Donation")'),
    ).not.toBeVisible();

    // Verify no portal button is present
    await expect(page.locator('a[href="/subscribe/portal"]')).not.toBeVisible();

    // Verify subscription tier selector is present
    await expect(page.locator('label[for="tier-starving"]')).toBeVisible();
    await expect(page.locator('label[for="tier-employed"]')).toBeVisible();
    await expect(page.locator('label[for="tier-rich"]')).toBeVisible();
    await expect(page.locator('label[for="tier-custom"]')).toBeVisible();

    // Verify "Start Monthly Donation" button is present (not "Update")
    await expect(
      page.locator('button:has-text("Start Monthly Donation")'),
    ).toBeVisible();
  });
});
