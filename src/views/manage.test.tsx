import { describe, expect, test } from "bun:test";
import type Stripe from "stripe";
import { ManagePage } from "./manage";

describe("ManagePage", () => {
  test("should render with email", async () => {
    const result = await (<ManagePage email="test@example.com" />);

    expect(result).toBeTypeOf("string");
    expect(result).toContain("test@example.com");
  });

  test("should display error message when provided", async () => {
    const errorMessage = "Failed to update subscription";
    const result = await (
      <ManagePage
        email="test@example.com"
        messages={[{ type: "error", text: errorMessage }]}
      />
    );

    expect(result).toBeTypeOf("string");
    expect(result).toContain(errorMessage);
    expect(result).toContain('class="message message-error"');
  });

  test("should display info message when provided", async () => {
    const infoMessage = "Your donation amount has been updated.";
    const result = await (
      <ManagePage
        email="test@example.com"
        messages={[{ type: "info", text: infoMessage }]}
      />
    );

    expect(result).toBeTypeOf("string");
    expect(result).toContain(infoMessage);
    expect(result).toContain('class="message message-info"');
  });

  test("should not display message when no messages provided", async () => {
    const result = await (<ManagePage email="test@example.com" />);

    expect(result).toBeTypeOf("string");
    expect(result).not.toContain('class="message ');
  });

  test("should display cancel form when subscription exists", async () => {
    const mockCustomer: Stripe.Customer = {
      id: "cus_123",
      object: "customer",
      balance: 0,
      created: 1234567890,
      default_source: null,
      delinquent: false,
      description: null,
      email: "test@example.com",
      invoice_settings: {
        custom_fields: null,
        default_payment_method: null,
        footer: null,
        rendering_options: null,
      },
      livemode: false,
      metadata: {},
      shipping: null,
    };

    const mockSubscription: Stripe.Subscription = {
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
        data: [],
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

    const result = await (
      <ManagePage
        email="test@example.com"
        customer={mockCustomer}
        subscription={mockSubscription}
      />
    );

    expect(result).toBeTypeOf("string");
    expect(result).toContain("Cancel Monthly Donation");
  });
});
