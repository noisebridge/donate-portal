import { describe, expect, test } from "bun:test";
import { createMockSubscription } from "~/test-utils/mock-subscription";
import { DonationTierSelector } from "./donation-tier-selector";

describe("DonationTierSelector", () => {
  test("with no subscription: employed tier is pre-selected as default", async () => {
    const result = await (<DonationTierSelector csrfToken={undefined} />);

    expect(result).toBeTypeOf("string");
    // Employed tier should be checked by default when no subscription
    expect(result).toContain('id="tier-employed"');
    // Look for the checked attribute on the employed tier
    expect(result).toMatch(/id="tier-employed"[^>]*checked/);
  });

  test("with $50 subscription: starving tier shows as current", async () => {
    const subscription = createMockSubscription({ unitAmount: 5000 }); // $50 = 5000 cents
    const result = await (
      <DonationTierSelector subscription={subscription} csrfToken={undefined} />
    );

    expect(result).toBeTypeOf("string");
    // Starving tier should be checked
    expect(result).toMatch(/id="tier-starving"[^>]*checked/);
    // Employed should not be checked
    expect(result).not.toMatch(/id="tier-employed"[^>]*checked/);
  });

  test("with $100 subscription: employed tier shows as current", async () => {
    const subscription = createMockSubscription({ unitAmount: 10000 }); // $100 = 10000 cents
    const result = await (
      <DonationTierSelector subscription={subscription} csrfToken={undefined} />
    );

    expect(result).toBeTypeOf("string");
    // Employed tier should be checked
    expect(result).toMatch(/id="tier-employed"[^>]*checked/);
  });

  test("with $200 subscription: rich tier shows as current", async () => {
    const subscription = createMockSubscription({ unitAmount: 20000 }); // $200 = 20000 cents
    const result = await (
      <DonationTierSelector subscription={subscription} csrfToken={undefined} />
    );

    expect(result).toBeTypeOf("string");
    // Rich tier should be checked
    expect(result).toMatch(/id="tier-rich"[^>]*checked/);
  });

  test("with custom amount subscription: custom tier selected with correct value", async () => {
    const subscription = createMockSubscription({ unitAmount: 7500 }); // $75 = 7500 cents (non-standard)
    const result = await (
      <DonationTierSelector subscription={subscription} csrfToken={undefined} />
    );

    expect(result).toBeTypeOf("string");
    // Custom tier should be checked
    expect(result).toMatch(/id="tier-custom"[^>]*checked/);
    // Custom input should show the value
    expect(result).toContain('value="75.00"');
  });

  test("without subscription: button says 'Start Monthly Donation'", async () => {
    const result = await (<DonationTierSelector csrfToken={undefined} />);

    expect(result).toBeTypeOf("string");
    expect(result).toContain("Start Monthly Donation");
    expect(result).not.toContain("Update Monthly Donation");
  });

  test("with subscription: button says 'Update Monthly Donation'", async () => {
    const subscription = createMockSubscription({ unitAmount: 5000 });
    const result = await (
      <DonationTierSelector subscription={subscription} csrfToken={undefined} />
    );

    expect(result).toBeTypeOf("string");
    expect(result).toContain("Update Monthly Donation");
    expect(result).not.toContain("Start Monthly Donation");
  });

  test("with subscription: shows update_tier section heading", async () => {
    const subscription = createMockSubscription({ unitAmount: 5000 });
    const result = await (
      <DonationTierSelector subscription={subscription} csrfToken={undefined} />
    );

    expect(result).toBeTypeOf("string");
    expect(result).toContain("update_tier");
  });

  test("without subscription: shows choose_tier section heading", async () => {
    const result = await (<DonationTierSelector csrfToken={undefined} />);

    expect(result).toBeTypeOf("string");
    expect(result).toContain("choose_tier");
  });
});
