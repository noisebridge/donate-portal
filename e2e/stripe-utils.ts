import type { Page } from "@playwright/test";
import { expect } from "./fixtures";

/**
 * Get expiry date one year from now in MM/YY format
 */
export function getExpiryOneYearFromNow(): string {
  const date = new Date();
  date.setFullYear(date.getFullYear() + 1);

  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = String(date.getFullYear()).slice(-2);

  return `${month}/${year}`;
}

/**
 * Wait for the Stripe checkout modal to become visible and the Payment Element
 * to finish loading inside it.
 */
export async function waitForCheckoutModal(page: Page) {
  const modal = page.locator("#stripe-checkout-modal");
  await expect(modal).toBeVisible();
  // Wait for the Stripe Payment Element iframe to load inside the modal
  await expect(modal.locator("#payment-element iframe")).toBeAttached({
    timeout: 15000,
  });
}

/**
 * Fill out the Stripe Payment Element card form inside the checkout modal.
 * All card fields live in a single iframe rendered by the Payment Element.
 */
export async function fillStripePaymentElement(
  page: Page,
  options: {
    cardNumber: string;
    expiry: string;
    cvc: string;
    zip?: string;
  },
) {
  const frame = page.locator("#payment-element").frameLocator("iframe").first();

  await frame
    .locator("#payment-numberInput")
    .fill(options.cardNumber, { timeout: 10000 });
  await frame
    .locator("#payment-expiryInput")
    .fill(options.expiry, { timeout: 10000 });
  await frame
    .locator("#payment-cvcInput")
    .fill(options.cvc, { timeout: 10000 });

  if (options.zip) {
    const postalCode = frame.locator("#payment-postalCodeInput");
    if (await postalCode.isVisible()) {
      await postalCode.fill(options.zip);
    }
  }
}

/**
 * Wait for the Stripe Embedded Checkout to load inside the checkout modal.
 * Embedded Checkout renders in an iframe named "embedded-checkout".
 */
export async function waitForEmbeddedCheckout(page: Page) {
  const modal = page.locator("#stripe-checkout-modal");
  await expect(modal).toBeVisible();
  await expect(modal.locator('iframe[name="embedded-checkout"]')).toBeAttached({
    timeout: 15000,
  });
  // Wait for form fields to be ready inside the iframe
  const frame = modal.frameLocator('iframe[name="embedded-checkout"]');
  await expect(frame.locator("#cardNumber")).toBeVisible({ timeout: 15000 });
}

/**
 * Fill out the Stripe Embedded Checkout form inside the checkout modal.
 * Embedded Checkout renders a full Stripe checkout form in a single iframe
 * named "embedded-checkout" with fields like #cardNumber, #cardExpiry, etc.
 */
export async function fillEmbeddedCheckoutForm(
  page: Page,
  options: {
    cardNumber: string;
    expiry: string;
    cvc: string;
    name: string;
    zip: string;
  },
) {
  const frame = page
    .locator("#payment-element")
    .frameLocator('iframe[name="embedded-checkout"]');

  await frame
    .locator("#cardNumber")
    .fill(options.cardNumber, { timeout: 10000 });
  await frame.locator("#cardExpiry").fill(options.expiry, { timeout: 10000 });
  await frame.locator("#cardCvc").fill(options.cvc, { timeout: 10000 });
  await frame.locator("#billingName").fill(options.name, { timeout: 10000 });

  // Embedded Checkout does not always render a separate postal-code field, and
  // its element id drifts — Stripe varies it by card BIN / country / account
  // config and serves the iframe DOM live, independent of the pinned
  // @stripe/stripe-js version. Mirror fillStripePaymentElement: match it
  // resiliently (id OR name OR the postal-code autocomplete hint) and fill it
  // only when it actually appears, so a rename still fills it while a
  // genuinely-absent field is skipped instead of hard-failing.
  const postalCode = frame
    .locator(
      "#billingPostalCode, input[name='billingPostalCode'], input[autocomplete='postal-code']",
    )
    .first();
  const postalCodeShown = await postalCode
    .waitFor({ state: "visible", timeout: 3000 })
    .then(() => true)
    .catch(() => false);
  if (postalCodeShown) {
    await postalCode.fill(options.zip, { timeout: 10000 });
  }

  // Stripe Link's "Save my information" checkbox is checked by default,
  // which makes the phone number field required and blocks submission.
  const linkCheckbox = frame.getByRole("checkbox", {
    name: "Save my information",
  });
  if (await linkCheckbox.isChecked()) {
    await linkCheckbox.uncheck();
  }
}

/**
 * Click the submit button inside the Stripe Embedded Checkout iframe.
 */
export async function submitEmbeddedCheckout(page: Page) {
  const frame = page
    .locator("#payment-element")
    .frameLocator('iframe[name="embedded-checkout"]');

  await frame.locator('button[type="submit"]').click({ timeout: 10000 });
}
