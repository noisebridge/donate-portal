import { describe, expect, test } from "bun:test";
import type Stripe from "stripe";
import { DonationTierSelector } from "./donation-tier-selector";

function createMockSubscription(unitAmount: number): Stripe.Subscription {
  return {
    id: "sub_123",
    object: "subscription",
    application: null,
    application_fee_percent: null,
    automatic_tax: {
      enabled: false,
      liability: null,
      disabled_reason: null,
    },
    billing_cycle_anchor: 1234567890,
    billing_cycle_anchor_config: null,
    billing_mode: {
      type: "classic",
      flexible: null,
    },
    billing_thresholds: null,
    cancel_at: null,
    cancel_at_period_end: false,
    canceled_at: null,
    cancellation_details: null,
    collection_method: "charge_automatically",
    created: 1234567890,
    currency: "usd",
    customer: "cus_123",
    customer_account: "ca_123",
    days_until_due: null,
    default_payment_method: null,
    default_source: null,
    description: null,
    discounts: [],
    ended_at: null,
    invoice_settings: {
      account_tax_ids: null,
      issuer: { type: "self" },
    },
    items: {
      object: "list",
      data: [
        {
          id: "si_123",
          object: "subscription_item",
          billing_thresholds: null,
          created: 1234567890,
          discounts: [],
          metadata: {},
          plan: {
            id: "plan_123",
            object: "plan",
            active: true,
            amount: unitAmount,
            amount_decimal: unitAmount.toString(),
            billing_scheme: "per_unit",
            created: 1234567890,
            currency: "usd",
            interval: "month",
            interval_count: 1,
            livemode: false,
            metadata: {},
            meter: null,
            nickname: null,
            product: "prod_123",
            tiers_mode: null,
            transform_usage: null,
            trial_period_days: null,
            usage_type: "licensed",
          },
          price: {
            id: "price_123",
            object: "price",
            active: true,
            billing_scheme: "per_unit",
            created: 1234567890,
            currency: "usd",
            custom_unit_amount: null,
            livemode: false,
            lookup_key: null,
            metadata: {},
            nickname: null,
            product: "prod_123",
            recurring: {
              interval: "month",
              interval_count: 1,
              usage_type: "licensed",
              meter: null,
              trial_period_days: null,
            },
            tax_behavior: null,
            tiers_mode: null,
            transform_quantity: null,
            type: "recurring",
            unit_amount: unitAmount,
            unit_amount_decimal: unitAmount.toString(),
          },
          quantity: 1,
          subscription: "sub_123",
          tax_rates: [],
          current_period_end: Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60,
          current_period_start: Math.floor(Date.now() / 1000),
        },
      ],
      has_more: false,
      url: "/v1/subscription_items",
    },
    latest_invoice: null,
    livemode: false,
    metadata: {},
    next_pending_invoice_item_invoice: null,
    on_behalf_of: null,
    pause_collection: null,
    payment_settings: null,
    pending_invoice_item_interval: null,
    pending_setup_intent: null,
    pending_update: null,
    schedule: null,
    start_date: 1234567890,
    status: "active",
    test_clock: null,
    transfer_data: null,
    trial_end: null,
    trial_settings: null,
    trial_start: null,
  };
}

describe("DonationTierSelector", () => {
  test("with no subscription: employed tier is pre-selected as default", async () => {
    const result = await (<DonationTierSelector />);

    expect(result).toBeTypeOf("string");
    // Employed tier should be checked by default when no subscription
    expect(result).toContain('id="tier-employed"');
    // Look for the checked attribute on the employed tier
    expect(result).toMatch(/id="tier-employed"[^>]*checked/);
  });

  test("with $50 subscription: starving tier shows as current", async () => {
    const subscription = createMockSubscription(5000); // $50 = 5000 cents
    const result = await (<DonationTierSelector subscription={subscription} />);

    expect(result).toBeTypeOf("string");
    // Starving tier should be checked
    expect(result).toMatch(/id="tier-starving"[^>]*checked/);
    // Employed should not be checked
    expect(result).not.toMatch(/id="tier-employed"[^>]*checked/);
  });

  test("with $100 subscription: employed tier shows as current", async () => {
    const subscription = createMockSubscription(10000); // $100 = 10000 cents
    const result = await (<DonationTierSelector subscription={subscription} />);

    expect(result).toBeTypeOf("string");
    // Employed tier should be checked
    expect(result).toMatch(/id="tier-employed"[^>]*checked/);
  });

  test("with $200 subscription: rich tier shows as current", async () => {
    const subscription = createMockSubscription(20000); // $200 = 20000 cents
    const result = await (<DonationTierSelector subscription={subscription} />);

    expect(result).toBeTypeOf("string");
    // Rich tier should be checked
    expect(result).toMatch(/id="tier-rich"[^>]*checked/);
  });

  test("with custom amount subscription: custom tier selected with correct value", async () => {
    const subscription = createMockSubscription(7500); // $75 = 7500 cents (non-standard)
    const result = await (<DonationTierSelector subscription={subscription} />);

    expect(result).toBeTypeOf("string");
    // Custom tier should be checked
    expect(result).toMatch(/id="tier-custom"[^>]*checked/);
    // Custom input should show the value
    expect(result).toContain('value="75.00"');
  });

  test("without subscription: button says 'Start Monthly Donation'", async () => {
    const result = await (<DonationTierSelector />);

    expect(result).toBeTypeOf("string");
    expect(result).toContain("Start Monthly Donation");
    expect(result).not.toContain("Update Monthly Donation");
  });

  test("with subscription: button says 'Update Monthly Donation'", async () => {
    const subscription = createMockSubscription(5000);
    const result = await (<DonationTierSelector subscription={subscription} />);

    expect(result).toBeTypeOf("string");
    expect(result).toContain("Update Monthly Donation");
    expect(result).not.toContain("Start Monthly Donation");
  });

  test("with subscription: portal button is visible", async () => {
    const subscription = createMockSubscription(5000);
    const result = await (<DonationTierSelector subscription={subscription} />);

    expect(result).toBeTypeOf("string");
    expect(result).toContain('action="/subscribe/portal"');
    expect(result).toContain("Past Invoices and Payment Methods");
  });

  test("without subscription: portal button is not visible", async () => {
    const result = await (<DonationTierSelector />);

    expect(result).toBeTypeOf("string");
    expect(result).not.toContain('action="/subscribe/portal"');
  });
});
