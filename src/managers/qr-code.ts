import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import bmp from "bmp-js";
import baseLogger from "~/lib/logger";
import QRCode, { type QRCodeModel } from "~/lib/qrcode-svg";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function clone<T>(object: T): T {
  return Object.assign(
    Object.create(Object.getPrototypeOf(object)),
    structuredClone(object),
  );
}

export const QR_FOREGROUND = "black";
export const QR_BACKGROUND = "transparent";

type BMPColor = "transparent" | "white" | "black";

const log = baseLogger.child({ module: "qr-code" });

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
 * @returns 2D array of `BMPColor`s, indexed as [row][col]
 */
function decodeBMP(filePath: string): BMPColor[][] {
  const buffer = readFileSync(filePath);
  const decoded = bmp.decode(buffer);

  const { width, height, data } = decoded;

  const result: BMPColor[][] = new Array(height);
  for (let y = 0; y < height; y++) {
    result[y] = new Array<BMPColor>(width).fill("transparent");
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
      result[y]![x] = classifyColor(r, g, b) ?? "white";
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

/**
 * Fake QR code shown for error states.
 */
const ERROR_QR_CODE = bmpToQRCode(
  "Error",
  decodeBMP(`${__dirname}/qr-error.bmp`),
);
/**
 * Pattern shown in the center of QR codes.
 */
export const QR_INSERT = decodeBMP(`${__dirname}/qr-insert.bmp`);

/**
 * Create a QR code from a URL string.
 * @param url The URL to encode
 * @param useLogo Whether to include the logo in the QR code
 */
export function create(url: string, useLogo = true) {
  const qrCode = new QRCode({
    content: url,
    padding: 0,
    join: true,
    ecl: "H",
    color: QR_FOREGROUND,
    background: QR_BACKGROUND,
  });

  if (!useLogo) {
    return qrCode;
  }

  const qrCodeWithInsert = addInsert(qrCode);
  if (!qrCodeWithInsert) {
    return ERROR_QR_CODE;
  }

  return qrCodeWithInsert;
}

/**
 * Insert an image into the middle of the QR code.
 * @param qrCode The starting `QRCode`
 * @returns A new `QRCode`
 */
function addInsert(originalQRCode: QRCode) {
  const qrCode = clone(originalQRCode);
  const moduleCount = qrCode.qrcode.moduleCount;
  if (moduleCount < 33) {
    log.error("QR code is too small to contain the insert");
    return null;
  }

  // insert is indexed as [row][col], so insert.length is height (rows)
  const height = QR_INSERT.length;
  const width = QR_INSERT[0]?.length;
  if (!width || !height) {
    log.error("Invalid dimensions");
    return null;
  }
  if (height >= moduleCount || width >= moduleCount) {
    log.error("Insert is too large for the QR code");
    return null;
  }

  const startCol = Math.floor((moduleCount - width) / 2);
  const startRow = Math.floor((moduleCount - height) / 2);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      // biome-ignore lint/style/noNonNullAssertion: YOLO
      const color = QR_INSERT[y]![x]!;

      switch (color) {
        case "transparent":
          continue;
        case "white":
          // biome-ignore lint/style/noNonNullAssertion: YOLO
          qrCode.qrcode.modules[y + startRow]![x + startCol]! = false;
          break;
        case "black":
          // biome-ignore lint/style/noNonNullAssertion: YOLO
          qrCode.qrcode.modules[y + startRow]![x + startCol]! = true;
          break;
      }
    }
  }

  return qrCode;
}
