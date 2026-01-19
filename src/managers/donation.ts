import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import bmp from "bmp-js";
import QRCode, { type QRCodeModel } from "qrcode-svg";
import config from "~/config";
import { baseLogger } from "~/logger";
import type { Cents } from "~/money";
import paths from "~/paths";
import stripe from "~/services/stripe";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function clone<T>(object: T): T {
  return Object.assign(
    Object.create(Object.getPrototypeOf(object)),
    structuredClone(object),
  );
}

type BMPColor = "transparent" | "white" | "black";

/**
 * Classify an RGBA pixel as a `BMPColor`.
 */
function classifyColor(r: number, g: number, b: number): BMPColor | null {
  if (r === 255 && g === 0 && b === 255) {
    return "transparent";
  }
  if (r === 0 && g === 0 && b === 0) {
    return "black";
  }
  if (r === 255 && g === 255 && b === 255) {
    return "white";
  }

  return null;
}

/**
 * Decode a BMP file into a 2D array of color strings.
 * @param filePath Path to the BMP file
 * @returns 2D array of `BMPColor`s
 */
function decodeBMP(filePath: string): BMPColor[][] {
  const buffer = readFileSync(filePath);
  const decoded = bmp.decode(buffer);

  const { width, height, data } = decoded;
  const result: BMPColor[][] = new Array(width);

  for (let x = 0; x < width; x++) {
    result[x] = new Array(height);
  }

  // BMP data is stored row by row (y * width + x)
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      // Alpha channel is at data[i + 0] and is unused
      const b = data[i + 1] ?? 0;
      const g = data[i + 2] ?? 0;
      const r = data[i + 3] ?? 0;

      // biome-ignore lint/style/noNonNullAssertion: YOLO
      result[x]![y] = classifyColor(r, g, b) ?? "white";
    }
  }

  return result;
}

function bmpToQRCode(data: string, bmp: BMPColor[][]): QRCode {
  const model: QRCodeModel = {
    moduleCount: bmp.length,
    modules: bmp.map((row) => row.map((cell) => cell === "black")),
  };

  const qrCode = new QRCode(data);
  qrCode.qrcode = model;

  return qrCode;
}

export enum DonationErrorCode {
  InvalidAmount = "Please select a valid donation amount",
  SessionError = "Unable to process donation. Please try again.",
}

export type DonateResult =
  | { success: true; checkoutUrl: string; sessionId: string }
  | { success: false; error: DonationErrorCode };

export class DonationManager {
  static readonly log = baseLogger.child({ class: "DonationManager" });
  static readonly minimumAmount: Cents = { cents: 200 };
  static readonly defaultName = "Donation to Noisebridge";
  static readonly defaultDescription = "Support our hackerspace community";
  /**
   * Fake QR code shown for error states.
   */
  static readonly errorQrCode = bmpToQRCode(
    "Error",
    decodeBMP(`${__dirname}/qr-error.bmp`),
  );
  /**
   * Pattern shown in the center of QR codes.
   */
  static readonly qrInsert = decodeBMP(`${__dirname}/qr-insert.bmp`);

  /**
   * Create a one-time donation checkout session.
   * @param amountCents Donation amount
   * @param name Product name
   * @param description Product description
   */
  async donate(
    amount: Cents,
    name?: string,
    description?: string,
  ): Promise<DonateResult> {
    if (amount.cents < DonationManager.minimumAmount.cents) {
      return { success: false, error: DonationErrorCode.InvalidAmount };
    }

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: {
              name: name ?? DonationManager.defaultName,
              description: description ?? DonationManager.defaultDescription,
            },
            unit_amount: amount.cents,
          },
          quantity: 1,
        },
      ],
      mode: "payment",
      success_url: `${config.baseUrl}${paths.thankYou()}`,
      cancel_url: `${config.baseUrl}${paths.index()}`,
    });
    if (!session.url) {
      return { success: false, error: DonationErrorCode.SessionError };
    }

    return {
      success: true,
      checkoutUrl: session.url,
      sessionId: session.id,
    };
  }

  /**
   * Create a QR code to initiate a one-time donation.
   * @param amount Donation amount
   * @param name Product name
   * @param description Product description
   * @param useLogo Whether to include the logo in the QR code
   */
  createQRCode(
    amount: Cents,
    name?: string,
    description?: string,
    useLogo = true,
  ) {
    const url = `${config.baseUrl}${paths.qr(amount, name, description)}`;
    const qrCode = new QRCode({
      content: url,
      padding: 0,
      join: true,
      ecl: "H",
      background: "transparent",
    });

    if (!useLogo) {
      return qrCode;
    }

    const qrCodeWithInsert = this.addInsert(qrCode);
    if (!qrCodeWithInsert) {
      return DonationManager.errorQrCode;
    }

    return qrCodeWithInsert;
  }

  /**
   * Insert an image into the middle of the QR code.
   * @param qrCode The starting `QRCode`
   * @returns A modified copy of `qrCode`
   */
  private addInsert(originalQRCode: QRCode) {
    const qrCode = clone(originalQRCode);
    const moduleCount = qrCode.qrcode.moduleCount;
    if (moduleCount < 33) {
      DonationManager.log.error("QR code is too small to contain the insert");
      return null;
    }

    // insert is indexed as [x][y], so insert.length is width (columns)
    const width = DonationManager.qrInsert.length;
    const height = DonationManager.qrInsert[0]?.length;
    if (!width || !height) {
      DonationManager.log.error("Invalid dimensions");
      return null;
    }
    if (height >= moduleCount || width >= moduleCount) {
      DonationManager.log.error("Insert is too large for the QR code");
      return null;
    }

    const startCol = Math.floor((moduleCount - width) / 2);
    const startRow = Math.floor((moduleCount - height) / 2);

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        // biome-ignore lint/style/noNonNullAssertion: YOLO
        const color = DonationManager.qrInsert[x]![y]!;

        switch (color) {
          case "transparent":
            continue;
          case "white":
            // biome-ignore lint/style/noNonNullAssertion: YOLO
            qrCode.qrcode.modules[x + startCol]![y + startRow]! = false;
            break;
          case "black":
            // biome-ignore lint/style/noNonNullAssertion: YOLO
            qrCode.qrcode.modules[x + startCol]![y + startRow]! = true;
            break;
        }
      }
    }

    return qrCode;
  }
}

const donationManager = new DonationManager();
export default donationManager;
