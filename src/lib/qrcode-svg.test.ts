import { describe, expect, test } from "bun:test";
import QRCode from "./qrcode-svg";

function generateRandomString(length: number): string {
  let result = "";
  const charset =
    "abcdefghijklnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  for (let i = 0; i < length; i++) {
    result += charset.charAt(Math.floor(Math.random() * charset.length));
  }
  return result;
}

describe("QRCode", () => {
  describe("SVG output", () => {
    test("generates valid SVG string", () => {
      const svg = new QRCode("Hello World!").svg();
      expect(svg).toMatch(/<svg[\s\S]+<\/svg>/);
      expect(svg).toMatch(/<rect[\s\S]+/);
    });

    test("draws modules at [row][col] rather than transposed", () => {
      const qrCode = new QRCode({ content: "orientation", padding: 0 });
      const { modules, moduleCount } = qrCode.qrcode;

      // Find a cell that differs from its mirror, so the two orientations
      // are distinguishable in the output.
      let asymmetric: [number, number] | null = null;
      for (let row = 0; row < moduleCount && !asymmetric; row++) {
        for (let col = 0; col < moduleCount; col++) {
          if (modules[row]?.[col] !== modules[col]?.[row]) {
            asymmetric = [row, col];
            break;
          }
        }
      }
      expect(asymmetric).not.toBeNull();

      const [row, col] = asymmetric as [number, number];
      const [darkRow, darkCol] = modules[row]?.[col] ? [row, col] : [col, row];

      // One module per unit, so SVG coordinates are the module indices.
      const svg = new QRCode({
        content: "orientation",
        padding: 0,
        width: moduleCount,
        height: moduleCount,
      }).svg();

      expect(svg).toContain(`<rect x="${darkCol}" y="${darkRow}"`);
      expect(svg).not.toContain(`<rect x="${darkRow}" y="${darkCol}"`);
    });
  });

  describe("padding options", () => {
    test("accepts padding of 0", () => {
      expect(() =>
        new QRCode({ content: "test", padding: 0 }).svg(),
      ).not.toThrow();
    });

    test("rejects negative padding", () => {
      expect(() =>
        new QRCode({ content: "test", padding: -1 }).svg(),
      ).toThrow();
    });
  });

  describe("width and height options", () => {
    test("accepts width=1 height=1", () => {
      expect(() =>
        new QRCode({ content: "test", width: 1, height: 1 }).svg(),
      ).not.toThrow();
    });

    test("rejects negative width", () => {
      expect(() => new QRCode({ content: "test", width: -1 }).svg()).toThrow();
    });

    test("rejects negative height", () => {
      expect(() => new QRCode({ content: "test", height: -1 }).svg()).toThrow();
    });
  });

  describe("content length", () => {
    test("throws on empty string", () => {
      expect(() => new QRCode("")).toThrow();
    });

    test("accepts 1 character", () => {
      expect(() => new QRCode(generateRandomString(1))).not.toThrow();
    });

    const reserved = 3;

    test("accepts max length for ECL L (2950 chars)", () => {
      expect(
        () =>
          new QRCode({
            content: generateRandomString(2953 - reserved),
            ecl: "L",
          }),
      ).not.toThrow();
    });

    test("rejects over max length for ECL L", () => {
      expect(
        () =>
          new QRCode({
            content: generateRandomString(2953 - reserved + 1),
            ecl: "L",
          }),
      ).toThrow();
    });

    test("accepts max length for ECL M (2328 chars)", () => {
      expect(
        () =>
          new QRCode({
            content: generateRandomString(2331 - reserved),
            ecl: "M",
          }),
      ).not.toThrow();
    });

    test("rejects over max length for ECL M", () => {
      expect(
        () =>
          new QRCode({
            content: generateRandomString(2331 - reserved + 1),
            ecl: "M",
          }),
      ).toThrow();
    });

    test("accepts max length for ECL Q (1660 chars)", () => {
      expect(
        () =>
          new QRCode({
            content: generateRandomString(1663 - reserved),
            ecl: "Q",
          }),
      ).not.toThrow();
    });

    test("rejects over max length for ECL Q", () => {
      expect(
        () =>
          new QRCode({
            content: generateRandomString(1663 - reserved + 1),
            ecl: "Q",
          }),
      ).toThrow();
    });

    test("accepts max length for ECL H (1270 chars)", () => {
      expect(
        () =>
          new QRCode({
            content: generateRandomString(1273 - reserved),
            ecl: "H",
          }),
      ).not.toThrow();
    });

    test("rejects over max length for ECL H", () => {
      expect(
        () =>
          new QRCode({
            content: generateRandomString(1273 - reserved + 1),
            ecl: "H",
          }),
      ).toThrow();
    });
  });

  describe("containers", () => {
    test("svg container has svg element without viewBox", () => {
      const svg = new QRCode({ content: "test" }).svg({ container: "svg" });
      expect(svg).toMatch(/<svg\s+/);
      expect(svg).not.toMatch(/viewbox=/i);
    });

    test("svg-viewbox container has svg element with viewBox", () => {
      const svg = new QRCode({ content: "test" }).svg({
        container: "svg-viewbox",
      });
      expect(svg).toMatch(/<svg\s+/);
      expect(svg).toMatch(/viewBox=/);
    });
  });

  describe("pretty printing", () => {
    test("indented rect in svg-viewbox container", () => {
      const svg = new QRCode({ content: "test" }).svg({
        container: "svg-viewbox",
      });
      expect(svg).toMatch(/[\r\n]+\s+<rect\s+/);
    });
  });

  describe("rendering options", () => {
    test("uses rect elements by default", () => {
      const svg = new QRCode({ content: "test" }).svg();
      expect(svg.split(/<rect\s+/).length).toBeGreaterThanOrEqual(20);
    });

    test("uses path element when join is true", () => {
      const svg = new QRCode({ content: "test", join: true }).svg();
      expect(svg.split(/<rect\s+/).length - 1).toBe(1);
      expect(svg).toMatch(/<path\s+[^>]+d=/);
    });
  });
});
