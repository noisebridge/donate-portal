import { expect, test } from "@playwright/test";

test.describe("QR Editor Page", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/qr-editor");
  });

  test("displays the QR editor page with correct title", async ({ page }) => {
    await expect(page.locator("h1")).toContainText("Donation QR Code Creator");
  });

  test("shows placeholder when no amount is entered", async ({ page }) => {
    const placeholder = page.locator("#qr-placeholder");
    const qrImage = page.locator("#qr-image");

    await expect(placeholder).toBeVisible();
    await expect(qrImage).not.toBeVisible();
  });

  test("shows QR code when valid amount is entered", async ({ page }) => {
    const amountInput = page.locator("#amount");
    const placeholder = page.locator("#qr-placeholder");
    const qrImage = page.locator("#qr-image");

    await amountInput.fill("5.00");

    await expect(placeholder).not.toBeVisible();
    await expect(qrImage).toBeVisible();
  });

  test("hides QR code when amount is below minimum", async ({ page }) => {
    const amountInput = page.locator("#amount");
    const placeholder = page.locator("#qr-placeholder");
    const qrImage = page.locator("#qr-image");

    await amountInput.fill("1.50");

    await expect(placeholder).toBeVisible();
    await expect(qrImage).not.toBeVisible();
  });

  test("shows QR code for exactly minimum amount ($2.00)", async ({ page }) => {
    const amountInput = page.locator("#amount");
    const qrImage = page.locator("#qr-image");

    await amountInput.fill("2.00");

    await expect(qrImage).toBeVisible();
  });

  test("updates URL display when amount is entered", async ({ page }) => {
    const amountInput = page.locator("#amount");
    const urlInput = page.locator("#qr-url");

    const initialUrl = await urlInput.inputValue();
    expect(initialUrl).toContain("/qr");
    expect(initialUrl).not.toContain("amount=");

    await amountInput.fill("10.00");

    const updatedUrl = await urlInput.inputValue();
    expect(updatedUrl).toContain("amount=10");
  });

  test("includes name in URL when provided", async ({ page }) => {
    const amountInput = page.locator("#amount");
    const nameInput = page.locator("#name");
    const urlInput = page.locator("#qr-url");

    await amountInput.fill("5.00");
    await nameInput.fill("Test");

    const url = await urlInput.inputValue();
    expect(url).toContain("name=Test");
  });

  test("includes description in URL when provided", async ({ page }) => {
    const amountInput = page.locator("#amount");
    const descriptionInput = page.locator("#description");
    const urlInput = page.locator("#qr-url");

    await amountInput.fill("5.00");
    await descriptionInput.fill("Test");

    const url = await urlInput.inputValue();
    expect(url).toContain("description=Test");
  });

  test("QR image updates when logo checkbox is toggled", async ({ page }) => {
    const amountInput = page.locator("#amount");
    const useLogoCheckbox = page.locator("#use-logo");
    const qrImage = page.locator("#qr-image");

    await amountInput.fill("5.00");
    await expect(qrImage).toBeVisible();

    const srcWithLogo = await qrImage.getAttribute("src");
    expect(srcWithLogo).toContain("use-logo=true");

    await useLogoCheckbox.uncheck();

    const srcWithoutLogo = await qrImage.getAttribute("src");
    expect(srcWithoutLogo).toContain("use-logo=false");
  });

  test("download PNG button is present", async ({ page }) => {
    const downloadPngButton = page.locator("#download-png");

    await expect(downloadPngButton).toBeVisible();
    await expect(downloadPngButton).toHaveText("Download PNG");
  });

  test("download SVG button is present", async ({ page }) => {
    const downloadSvgButton = page.locator("#download-svg");

    await expect(downloadSvgButton).toBeVisible();
    await expect(downloadSvgButton).toHaveText("Download SVG");
  });

  test("form has correct input fields", async ({ page }) => {
    await expect(page.locator("#amount")).toBeVisible();
    await expect(page.locator("#name")).toBeVisible();
    await expect(page.locator("#description")).toBeVisible();
    await expect(page.locator("#use-logo")).toBeVisible();
  });

  test("amount input has correct placeholder", async ({ page }) => {
    const amountInput = page.locator("#amount");

    await expect(amountInput).toHaveAttribute("placeholder", "0.00");
  });

  test("use-logo checkbox is checked by default", async ({ page }) => {
    const useLogoCheckbox = page.locator("#use-logo");

    await expect(useLogoCheckbox).toBeChecked();
  });
});

test.describe("QR Editor Navigation", () => {
  test("QR editor is accessible from navbar", async ({ page }) => {
    await page.goto("/");

    // Click the QR code icon in the navbar
    await page.click('a[aria-label="QR Code Editor"]');

    await expect(page).toHaveURL("/qr-editor");
  });
});

test.describe("QR SVG Endpoint", () => {
  test("returns SVG for valid amount", async ({ page }) => {
    const response = await page.goto("/qr.svg?amount=5.00");

    expect(response?.status()).toBe(200);
    expect(response?.headers()["content-type"]).toContain("image/svg+xml");
  });

  test("returns 400 for missing amount", async ({ page }) => {
    const response = await page.goto("/qr.svg");

    expect(response?.status()).toBe(400);
  });

  test("returns 400 for invalid amount", async ({ page }) => {
    const response = await page.goto("/qr.svg?amount=invalid");

    expect(response?.status()).toBe(400);
  });

  test("accepts optional name parameter", async ({ page }) => {
    const response = await page.goto("/qr.svg?amount=5.00&name=TestDonation");

    expect(response?.status()).toBe(200);
  });

  test("accepts optional description parameter", async ({ page }) => {
    const response = await page.goto(
      "/qr.svg?amount=5.00&description=TestDescription",
    );

    expect(response?.status()).toBe(200);
  });

  test("accepts use-logo parameter", async ({ page }) => {
    const responseWithLogo = await page.goto(
      "/qr.svg?amount=5.00&use-logo=true",
    );
    expect(responseWithLogo?.status()).toBe(200);

    const responseWithoutLogo = await page.goto(
      "/qr.svg?amount=5.00&use-logo=false",
    );
    expect(responseWithoutLogo?.status()).toBe(200);
  });
});
