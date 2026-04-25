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
});
