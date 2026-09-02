// @ts-check

import {
  dollarPattern,
  enforcePattern,
  validateMinAmount,
} from "./util/validate.mjs";

/**
 * @param {string} text
 */
function slugify(text) {
  return text
    .toLocaleLowerCase()
    .replace(/[^a-z0-9]/g, "-")
    .replace(/-+/g, "-");
}

/**
 * Update the QR code URL and image based on form values.
 * @param {HTMLInputElement} amountInput
 * @param {HTMLInputElement} nameInput
 * @param {HTMLInputElement} descriptionInput
 * @param {HTMLInputElement} useLogoCheckbox
 */
function updateQrCode(
  amountInput,
  nameInput,
  descriptionInput,
  useLogoCheckbox,
) {
  const qrUrlInput = /** @type {HTMLInputElement} */ (
    document.getElementById("qr-url")
  );
  const qrImage = /** @type {HTMLImageElement} */ (
    document.getElementById("qr-image")
  );
  const qrPlaceholder = /** @type {HTMLElement} */ (
    document.getElementById("qr-placeholder")
  );

  const donationUrl = qrUrlInput.value.split("?")[0] ?? "";

  const form = amountInput.form;
  const imageUrl = form?.action ?? "";

  const amount = parseFloat(amountInput.value);
  const name = nameInput.value;
  const description = descriptionInput.value;

  const minAmount = parseFloat(amountInput.dataset["min"] ?? "");
  if (Number.isNaN(minAmount)) {
    console.error(`Invalid data-min attribute "${amountInput.dataset["min"]}"`);
    return;
  }

  if (Number.isNaN(amount) || amount < minAmount) {
    qrImage.hidden = true;
    qrPlaceholder.hidden = false;
    qrUrlInput.value = donationUrl;
    return;
  }

  const params = new URLSearchParams({
    amount: amount.toString(),
    "use-logo": useLogoCheckbox.checked.toString(),
  });
  if (name) {
    params.set("name", name);
  }
  if (description) {
    params.set("description", description);
  }

  qrImage.src = `${imageUrl}?${params.toString()}`;
  qrImage.hidden = false;

  qrPlaceholder.hidden = true;

  params.delete("use-logo");
  qrUrlInput.value = `${donationUrl}?${params.toString()}`;
}

/**
 * Download the QR code as PNG
 * @param {HTMLInputElement} nameInput
 */
function downloadPng(nameInput) {
  const qrImage = /** @type {HTMLImageElement} */ (
    document.getElementById("qr-image")
  );
  if (!qrImage.src || qrImage.hidden) {
    return;
  }

  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    return;
  }

  // Create a new image to draw on canvas (handles cross-origin)
  const tempImg = new Image();
  tempImg.crossOrigin = "anonymous";
  tempImg.onload = () => {
    ctx.fillStyle = "white";
    ctx.fillRect(0, 0, 512, 512);
    ctx.drawImage(tempImg, 0, 0, 512, 512);

    const link = document.createElement("a");
    link.download = `qr-code-${slugify(nameInput.value || "donation")}.png`;
    link.href = canvas.toDataURL("image/png");
    link.click();
  };
  tempImg.src = qrImage.src;
}

/**
 * Download the QR code as SVG.
 * @param {HTMLInputElement} nameInput
 */
function downloadSvg(nameInput) {
  const qrImage = /** @type {HTMLImageElement} */ (
    document.getElementById("qr-image")
  );
  if (!qrImage.src || qrImage.hidden) {
    return;
  }

  const link = document.createElement("a");
  link.download = `qr-code-${slugify(nameInput.value || "donation")}.svg`;
  link.href = qrImage.src;
  link.click();
}

document.addEventListener("DOMContentLoaded", () => {
  const amountInput = /** @type {HTMLInputElement} */ (
    document.getElementById("amount")
  );
  const nameInput = /** @type {HTMLInputElement} */ (
    document.getElementById("name")
  );
  const descriptionInput = /** @type {HTMLInputElement} */ (
    document.getElementById("description")
  );
  const useLogoCheckbox = /** @type {HTMLInputElement} */ (
    document.getElementById("use-logo")
  );

  enforcePattern(amountInput, dollarPattern);

  validateMinAmount(amountInput);

  const update = () =>
    updateQrCode(amountInput, nameInput, descriptionInput, useLogoCheckbox);
  amountInput.addEventListener("input", update);
  nameInput.addEventListener("input", update);
  descriptionInput.addEventListener("input", update);
  useLogoCheckbox.addEventListener("change", update);

  const downloadPngButton = /** @type {HTMLButtonElement} */ (
    document.getElementById("download-png")
  );
  downloadPngButton.addEventListener("click", () => downloadPng(nameInput));

  const downloadSvgButton = /** @type {HTMLButtonElement} */ (
    document.getElementById("download-svg")
  );
  downloadSvgButton.addEventListener("click", () => downloadSvg(nameInput));
});
