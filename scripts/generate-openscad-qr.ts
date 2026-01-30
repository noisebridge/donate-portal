#!/usr/bin/env bun

import { execSync } from "node:child_process";
import { mkdirSync, unlinkSync, writeFileSync } from "node:fs";
import { basename, resolve } from "node:path";
import { parseArgs } from "node:util";
import dotenv from "dotenv";

dotenv.config({ path: `${__dirname}/../.env` });
// Only generate QR codes for production
process.env["SERVER_HOST"] = "donate.noisebridge.net";
process.env["NODE_ENV"] = "production";

const { DonationManager } = await import("~/managers/donation");

// --- String helpers ---

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function escapeScadString(s: string): string {
  return `"${s.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}

// --- Boolean grid operations ---

function bmpColorToBoolean(bmpColors: string[][]): boolean[][] {
  return bmpColors.map((col) => col.map((color) => color === "black"));
}

function centerBooleanArray(
  source: boolean[][],
  targetSize: number,
): boolean[][] {
  const sourceWidth = source.length;
  const sourceHeight = source[0]?.length ?? 0;
  const startCol = Math.floor((targetSize - sourceWidth) / 2);
  const startRow = Math.floor((targetSize - sourceHeight) / 2);

  const result: boolean[][] = [];
  for (let col = 0; col < targetSize; col++) {
    result[col] = [];
    for (let row = 0; row < targetSize; row++) {
      const sourceCol = col - startCol;
      const sourceRow = row - startRow;
      if (
        sourceCol >= 0 &&
        sourceCol < sourceWidth &&
        sourceRow >= 0 &&
        sourceRow < sourceHeight
      ) {
        // biome-ignore lint/style/noNonNullAssertion: YOLO
        result[col]![row] = source[sourceCol]![sourceRow]!;
      } else {
        // biome-ignore lint/style/noNonNullAssertion: YOLO
        result[col]![row] = false;
      }
    }
  }
  return result;
}

function subtract(a: boolean[][], b: boolean[][]): boolean[][] {
  const size = a.length;
  const result: boolean[][] = [];
  for (let col = 0; col < size; col++) {
    result[col] = [];
    for (let row = 0; row < size; row++) {
      // biome-ignore lint/style/noNonNullAssertion: YOLO
      result[col]![row] = a[col]![row]! && !b[col]![row]!;
    }
  }
  return result;
}

// --- OpenSCAD output ---

function formatSCADArray(name: string, modules: boolean[][]): string {
  const size = modules.length;
  const lines: string[] = [];
  lines.push(`${name} = [`);
  for (let row = 0; row < size; row++) {
    const cells: number[] = [];
    for (let col = 0; col < size; col++) {
      // biome-ignore lint/style/noNonNullAssertion: YOLO
      cells.push(modules[col]![row]! ? 1 : 0);
    }
    const comma = row < size - 1 ? "," : "";
    lines.push(`  [${cells.join(",")}]${comma}`);
  }
  lines.push("];");
  return lines.join("\n");
}

function buildWrapperScad(slug: string): string {
  return `\
use <qrs.scad>
include <qrs/${slug}.scad>

render_color = "black";
text_lines = ["","",""];

if (render_color == "black") {
    black(qr_data, text_lines);
} else if (render_color == "red") {
    red(qr_insert);
} else if (render_color == "white") {
    white(qr_data, qr_insert, text_lines);
} else {
    echo("Error: render_color must be 'black', 'red', or 'white'");
}
`;
}

function renderStl(
  wrapperPath: string,
  stlPath: string,
  color: string,
  textLines: string[],
  cwd: string,
): void {
  const textLinesScad = `[${textLines.map(escapeScadString).join(",")}]`;
  execSync(
    `
      openscad
        -o "${stlPath}"
        -D 'render_color="${color}"'
        -D 'text_lines=${textLinesScad}'
        "${wrapperPath}"
    `,
    { cwd, stdio: ["inherit", "inherit", "inherit"] },
  );
}

// --- CLI ---

function usage(): never {
  const script = basename(__filename);
  console.error(
    `Usage: bun scripts/${script} --amount <dollars> --text-lines <json> [--name <name>] [--description <desc>]`,
  );
  console.error("");
  console.error(
    "  -a, --amount       Donation amount in dollars (e.g. 5, 10.50)",
  );
  console.error(
    '  -t, --text-lines   JSON array of text lines (e.g. \'["3D","Filament","$20/roll"]\')',
  );
  console.error("  -n, --name         Optional product name");
  console.error("  -d, --description  Optional product description");
  process.exit(1);
}

function parseTextLines(raw: string): string[] {
  try {
    const parsed = JSON.parse(raw);
    if (
      !Array.isArray(parsed) ||
      !parsed.every((item) => typeof item === "string")
    ) {
      throw new Error("must be an array of strings");
    }
    return parsed;
  } catch (e) {
    console.error(`Invalid text_lines_json: ${(e as Error).message}`);
    process.exit(1);
  }
}

function parseCliArgs() {
  const {
    values: { help, amount, "text-lines": textLinesArg, name, description },
  } = parseArgs({
    args: process.argv.slice(2),
    options: {
      help: { type: "boolean", short: "h" },
      amount: { type: "string", short: "a" },
      "text-lines": { type: "string", short: "t" },
      name: { type: "string", short: "n" },
      description: { type: "string", short: "d" },
    },
  });

  if (help || !amount || !textLinesArg) {
    usage();
  }

  const dollars = parseFloat(amount);
  if (Number.isNaN(dollars) || dollars <= 0) {
    console.error(`Invalid amount: ${amount}`);
    process.exit(1);
  }

  return {
    cents: Math.round(dollars * 100),
    textLines: parseTextLines(textLinesArg),
    name,
    description,
  };
}

function checkOpenscad(): void {
  try {
    execSync("openscad --version", { stdio: "ignore" });
  } catch {
    console.error("openscad CLI not found. Please install OpenSCAD:");
    console.error("  brew install openscad        # macOS");
    console.error("  sudo apt install openscad    # Debian/Ubuntu");
    console.error("  https://openscad.org/downloads.html");
    process.exit(1);
  }
}

// --- Main ---

function main() {
  checkOpenscad();
  const args = parseCliArgs();

  const manager = new DonationManager();
  const qrCode = manager.createQRCode(
    { cents: args.cents },
    args.name,
    args.description,
  );

  const { modules: qrData, moduleCount } = qrCode.qrcode;
  if (moduleCount !== 53) {
    console.error("QR code should be 53 pixels wide but is ", moduleCount);
    console.error("All QR codes are expected to be this size");
    if (moduleCount < 53) {
      console.error("Add more text to name/description");
    } else {
      console.error("Remove text from the name/description");
    }
    process.exit(1);
  }

  const qrInsertCentered = centerBooleanArray(
    bmpColorToBoolean(DonationManager.qrInsert),
    moduleCount,
  );
  const qrDataWithoutInsert = subtract(qrData, qrInsertCentered);

  const scadContent = [
    formatSCADArray("qr_data", qrDataWithoutInsert),
    "",
    formatSCADArray("qr_insert", qrInsertCentered),
  ].join("\n");

  const slug = slugify(args.name ?? "donation");
  const openscadDir = resolve(__dirname, "openscad");
  const qrsDir = resolve(openscadDir, "qrs");
  mkdirSync(qrsDir, { recursive: true });

  const scadPath = resolve(qrsDir, `${slug}.scad`);
  writeFileSync(scadPath, `${scadContent}\n`);
  console.log(`Wrote ${scadPath}`);

  const wrapperPath = resolve(openscadDir, `${slug}-render.scad`);
  try {
    writeFileSync(wrapperPath, buildWrapperScad(slug));

    for (const color of ["black", "red", "white"]) {
      const stlPath = resolve(qrsDir, `${slug}-${color}.stl`);
      console.log(`Rendering ${color}...`);
      renderStl(wrapperPath, stlPath, color, args.textLines, openscadDir);
      console.log(`Wrote ${stlPath}`);
    }
  } finally {
    unlinkSync(wrapperPath);
  }
}

main();
