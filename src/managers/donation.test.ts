import { describe, expect, test } from "bun:test";
import { DonationManager } from "./donation";

describe("DonationManager", () => {
  const manager = new DonationManager();

  describe("createQRCode", () => {
    test("generates valid SVG output", () => {
      const qrCode = manager.createQRCode({ cents: 1000 });
      const svg = qrCode.svg({ container: "svg-viewbox" });

      expect(svg).toContain("<svg");
      expect(svg).toContain("viewBox");
      expect(svg).toContain("</svg>");
    });

    test("accepts both name and description when provided", () => {
      const qrCode = manager.createQRCode(
        { cents: 500 },
        "Test Donation",
        "Test description",
      );

      expect(qrCode.qrcode.moduleCount).toBeGreaterThan(0);
    });

    test("with useLogo=true (default) adds logo insert to QR code", () => {
      const qrCodeWithLogo = manager.createQRCode({ cents: 500 });
      const qrCodeWithoutLogo = manager.createQRCode(
        { cents: 500 },
        undefined,
        undefined,
        false,
      );

      // Both should generate valid QR codes
      expect(qrCodeWithLogo.qrcode.moduleCount).toBeGreaterThan(0);
      expect(qrCodeWithoutLogo.qrcode.moduleCount).toBeGreaterThan(0);

      // The modules should differ since one has the logo insert
      const withLogoSvg = qrCodeWithLogo.svg();
      const withoutLogoSvg = qrCodeWithoutLogo.svg();
      expect(withLogoSvg).not.toBe(withoutLogoSvg);
    });

    test("generates different output for different amounts", () => {
      const qr1 = manager.createQRCode(
        { cents: 500 },
        undefined,
        undefined,
        false,
      );
      const qr2 = manager.createQRCode(
        { cents: 1000 },
        undefined,
        undefined,
        false,
      );

      expect(qr1.svg()).not.toBe(qr2.svg());
    });

    test("handles minimum donation amount", () => {
      const qrCode = manager.createQRCode(DonationManager.minimumAmount);

      expect(qrCode.qrcode.moduleCount).toBeGreaterThan(0);
    });

    test("handles large donation amounts", () => {
      const qrCode = manager.createQRCode({ cents: 100000000 }); // $1,000,000

      expect(qrCode.qrcode.moduleCount).toBeGreaterThan(0);
    });
  });
});
