import { describe, expect, test } from "bun:test";
import { createMockSubscription } from "~/test-utils/mock-subscription";
import { DonationTierSelector } from "./donation-tier-selector";

describe("DonationTierSelector", () => {
  test("with no subscription: employed tier is pre-selected as default", () => {
    const result = String(<DonationTierSelector csrfToken={undefined} />);

    // Employed tier should be checked by default when no subscription
    expect(result).toContain('id="tier-employed"');
    // Look for the checked attribute on the employed tier
    expect(result).toMatch(/id="tier-employed"[^>]*checked/);
  });

  test("with $50 subscription: starving tier shows as current", () => {
    const subscription = createMockSubscription({ unitAmount: 5000 }); // $50 = 5000 cents
    const result = String(
      <DonationTierSelector
        subscription={subscription}
        csrfToken={undefined}
      />,
    );

    // Starving tier should be checked
    expect(result).toMatch(/id="tier-starving"[^>]*checked/);
    // Employed should not be checked
    expect(result).not.toMatch(/id="tier-employed"[^>]*checked/);
  });

  test("with $100 subscription: employed tier shows as current", () => {
    const subscription = createMockSubscription({ unitAmount: 10000 }); // $100 = 10000 cents
    const result = String(
      <DonationTierSelector
        subscription={subscription}
        csrfToken={undefined}
      />,
    );

    // Employed tier should be checked
    expect(result).toMatch(/id="tier-employed"[^>]*checked/);
  });

  test("with $200 subscription: rich tier shows as current", () => {
    const subscription = createMockSubscription({ unitAmount: 20000 }); // $200 = 20000 cents
    const result = String(
      <DonationTierSelector
        subscription={subscription}
        csrfToken={undefined}
      />,
    );

    // Rich tier should be checked
    expect(result).toMatch(/id="tier-rich"[^>]*checked/);
  });

  test("with custom amount subscription: custom tier selected with correct value", () => {
    const subscription = createMockSubscription({ unitAmount: 7500 }); // $75 = 7500 cents (non-standard)
    const result = String(
      <DonationTierSelector
        subscription={subscription}
        csrfToken={undefined}
      />,
    );

    // Custom tier should be checked
    expect(result).toMatch(/id="tier-custom"[^>]*checked/);
    // Custom input should show the value
    expect(result).toContain('value="75.00"');
  });

  test("without subscription: button says 'Start monthly donation'", () => {
    const result = String(<DonationTierSelector csrfToken={undefined} />);

    expect(result).toContain("Start monthly donation");
    expect(result).not.toContain("Update monthly donation");
  });

  test("with subscription: button says 'Update monthly donation'", () => {
    const subscription = createMockSubscription({ unitAmount: 5000 });
    const result = String(
      <DonationTierSelector
        subscription={subscription}
        csrfToken={undefined}
      />,
    );

    expect(result).toContain("Update monthly donation");
    expect(result).not.toContain("Start monthly donation");
  });

  test("with subscription: shows update_tier section heading", () => {
    const subscription = createMockSubscription({ unitAmount: 5000 });
    const result = String(
      <DonationTierSelector
        subscription={subscription}
        csrfToken={undefined}
      />,
    );

    expect(result).toContain("update_tier");
  });

  test("without subscription: shows choose_tier section heading", () => {
    const result = String(<DonationTierSelector csrfToken={undefined} />);

    expect(result).toContain("choose_tier");
  });
});
