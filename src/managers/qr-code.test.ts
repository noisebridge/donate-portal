import { describe, expect, test } from "bun:test";
import config from "~/config";
import paths from "~/lib/paths";
import { QRCodeManager } from "./qr-code";

describe("QRCodeManager", () => {
  const manager = new QRCodeManager();

  describe("createQRCode", () => {
    test("generates valid SVG output", () => {
      const url = `${config.baseUrl}${paths.qr({ cents: 1000 })}`;
      const qrCode = manager.createQRCode(url);
      const svg = qrCode.svg({ container: "svg-viewbox" });

      expect(svg).toContain("<svg");
      expect(svg).toContain("viewBox");
      expect(svg).toContain("</svg>");
    });

    test("with useLogo=true (default) adds logo insert to QR code", () => {
      const url = `${config.baseUrl}${paths.qr({ cents: 500 })}`;
      const qrCodeWithLogo = manager.createQRCode(url);
      const qrCodeWithoutLogo = manager.createQRCode(url, false);

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
      const qr1 = manager.createQRCode(url1, false);
      const qr2 = manager.createQRCode(url2, false);

      expect(qr1.svg()).not.toBe(qr2.svg());
    });

    test("handles long URLs", () => {
      const url = `${config.baseUrl}${paths.qr({ cents: 100000000 }, "Test Donation", "A long description")}`;
      const qrCode = manager.createQRCode(url);

      expect(qrCode.qrcode.moduleCount).toBeGreaterThan(0);
    });
  });
});
