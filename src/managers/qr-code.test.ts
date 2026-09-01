import { describe, expect, test } from "bun:test";
import config from "~/config";
import paths from "~/lib/paths";
import * as qrCodeManager from "./qr-code";

describe("qr-code", () => {
  const manager = qrCodeManager;

  describe("create", () => {
    test("generates valid SVG output", () => {
      const url = `${config.baseUrl}${paths.qr({ cents: 1000 })}`;
      const qrCode = manager.create(url);
      const svg = qrCode.svg({ container: "svg-viewbox" });

      expect(svg).toContain("<svg");
      expect(svg).toContain("viewBox");
      expect(svg).toContain("</svg>");
    });

    test("with useLogo=true (default) adds logo insert to QR code", () => {
      const url = `${config.baseUrl}${paths.qr({ cents: 500 })}`;
      const qrCodeWithLogo = manager.create(url);
      const qrCodeWithoutLogo = manager.create(url, false);

      // Both should generate valid QR codes
      expect(qrCodeWithLogo.qrcode.moduleCount).toBeGreaterThan(0);
      expect(qrCodeWithoutLogo.qrcode.moduleCount).toBeGreaterThan(0);

      // The modules should differ since one has the logo insert
      const withLogoSvg = qrCodeWithLogo.svg();
      const withoutLogoSvg = qrCodeWithoutLogo.svg();
      expect(withLogoSvg).not.toBe(withoutLogoSvg);
    });

    test("generates different output for different URLs", () => {
      const url1 = `${config.baseUrl}${paths.qr({ cents: 500 })}`;
      const url2 = `${config.baseUrl}${paths.qr({ cents: 1000 })}`;
      const qr1 = manager.create(url1, false);
      const qr2 = manager.create(url2, false);

      expect(qr1.svg()).not.toBe(qr2.svg());
    });

    test("falls back to the error QR code when the content is too small for the insert", () => {
      // A short payload produces a QR code with fewer than 33 modules, which
      // cannot fit the logo insert.
      const qrCode = manager.create("x");

      expect(qrCode.qrcode.moduleCount).toBeGreaterThanOrEqual(33);
      expect(qrCode.svg()).toBe(manager.create("y").svg());
    });

    test("handles long URLs", () => {
      const url = `${config.baseUrl}${paths.qr({ cents: 100000000 }, "Test Donation", "A long description")}`;
      const qrCode = manager.create(url);

      expect(qrCode.qrcode.moduleCount).toBeGreaterThan(0);
    });
  });
});
