import { describe, expect, test } from "bun:test";
import * as donationManager from "./donation";

describe("donation", () => {
  describe("MAX_NAME_LENGTH", () => {
    test("is defined as a positive number", () => {
      expect(donationManager.MAX_NAME_LENGTH).toBeGreaterThan(0);
    });
  });

  describe("MAX_DESCRIPTION_LENGTH", () => {
    test("is defined as a positive number", () => {
      expect(donationManager.MAX_DESCRIPTION_LENGTH).toBeGreaterThan(0);
    });
  });

  describe("isGeneral", () => {
    test("returns true when name is undefined", () => {
      expect(donationManager.isGeneral()).toBe(true);
    });

    test("returns true for the default donation name", () => {
      expect(donationManager.isGeneral(donationManager.DEFAULT_NAME)).toBe(
        true,
      );
    });

    test("returns true for 'Support Us'", () => {
      expect(donationManager.isGeneral("Support Us")).toBe(true);
    });

    test("returns false for a custom product name", () => {
      expect(donationManager.isGeneral("Laser Cutter")).toBe(false);
    });
  });
});
