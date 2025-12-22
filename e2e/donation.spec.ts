import { expect, type Page, test } from "@playwright/test";

/**
 * Get expiry date one year from now in MM/YY format
 */
function getExpiryOneYearFromNow(): string {
  const date = new Date();
  date.setFullYear(date.getFullYear() + 1);
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = String(date.getFullYear()).slice(-2);
  return `${month}/${year}`;
}

/**
 * Helper function to fill out the Stripe checkout form
 */
async function fillStripeCheckoutForm(
  page: Page,
  options: {
    email: string;
    cardNumber: string;
    expiry: string;
    cvc: string;
    name: string;
    zip: string;
  },
) {
  // Fill email
  await page.fill("#email", options.email);

  // Fill card number
  await page.fill("#cardNumber", options.cardNumber);

  // Fill expiry date
  await page.fill("#cardExpiry", options.expiry);

  // Fill CVC
  await page.fill("#cardCvc", options.cvc);

  // Fill cardholder name
  await page.fill("#billingName", options.name);

  // Fill ZIP code (country defaults to US)
  await page.fill("#billingPostalCode", options.zip);
}

test.describe("Donation Flow Tests", () => {
  test("Amount $10 button creates Stripe checkout and redirects to /thank-you", async ({
    page,
  }) => {
    await page.goto("/");

    // Click the $10 amount button
    await page.click('label[for="amount-10"]');

    // Submit the form
    await page.click('button[type="submit"]:has-text("Donate Now")');

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
    await page.click('button[type="submit"]:has-text("Pay")');

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
    await page.click('button[type="submit"]:has-text("Donate Now")');

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
    await page.click('button[type="submit"]:has-text("Pay")');

    // Should redirect to thank-you page after successful payment
    await expect(page).toHaveURL(/\/thank-you/);
  });
});
