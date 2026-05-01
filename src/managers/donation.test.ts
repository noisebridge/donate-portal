import { describe, expect, test } from "bun:test";
import { DonationManager } from "./donation";

describe("DonationManager", () => {
  describe("maxNameLength", () => {
    test("is defined as a positive number", () => {
      expect(DonationManager.maxNameLength).toBeGreaterThan(0);
    });
  });

  describe("maxDescriptionLength", () => {
    test("is defined as a positive number", () => {
      expect(DonationManager.maxDescriptionLength).toBeGreaterThan(0);
    });
  });

  describe("isGeneral", () => {
    test("returns true when name is undefined", () => {
      expect(DonationManager.isGeneral()).toBe(true);
    });

    test("returns true for the default donation name", () => {
      expect(DonationManager.isGeneral(DonationManager.defaultName)).toBe(true);
    });

    test("returns true for 'Support Us'", () => {
      expect(DonationManager.isGeneral("Support Us")).toBe(true);
    });

    test("returns false for a custom product name", () => {
      expect(DonationManager.isGeneral("Laser Cutter")).toBe(false);
    });
  });
});
