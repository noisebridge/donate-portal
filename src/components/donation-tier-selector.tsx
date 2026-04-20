import type Stripe from "stripe";
import { SubscriptionManager } from "~/managers/subscription";
import paths from "~/paths";

export interface Tier {
  id: string;
  name: string;
  amount: number;
}

export const TIERS: Tier[] = [
  { id: "starving", name: "Starving Hacker", amount: 50 },
  { id: "employed", name: "Employed Hacker", amount: 100 },
  { id: "rich", name: "Rich Hacker", amount: 200 },
];

function tierIndex(position: number): string {
  return `[${String(position + 1).padStart(2, "0")}]`;
}

interface DonationTierSelectorProps {
  subscription?: Stripe.Subscription | undefined;
}

function tierChecked(tier: Tier, existingAmount: number | null): boolean {
  if (!existingAmount) {
    return tier.id === "employed";
  }

  return tier.amount === existingAmount / 100;
}

export function DonationTierSelector({
  subscription,
}: DonationTierSelectorProps) {
  const existingAmount =
    subscription?.items?.data[0]?.price?.unit_amount ?? null;
  const tiers = TIERS.map((tier) => ({
    ...tier,
    checked: tierChecked(tier, existingAmount),
  }));
  const hasCustomAmount = !tiers.some((tier) => tier.checked);

  return (
    <section>
      <div class="section-head">
        <h2>{subscription ? "update_tier" : "choose_tier"}</h2>
        <div class="meta">
          {subscription
            ? "Change your monthly amount \u00b7 applies next cycle"
            : "Billed monthly in USD \u00b7 cancel anytime"}
        </div>
      </div>

      <form method="POST" action={paths.subscribe()} class="donation-tier-form">
        <fieldset class="tier-options">
          <legend class="visually-hidden">
            Select a monthly donation tier
          </legend>
          <div class="tier-grid">
            {tiers.map((tier, position) => (
              <label class="tier-chip" for={`tier-${tier.id}`}>
                <input
                  type="radio"
                  id={`tier-${tier.id}`}
                  name="amount-dollars"
                  value={tier.amount.toString()}
                  required
                  checked={tier.checked}
                />
                <span class="idx">{tierIndex(position) as "safe"}</span>
                <span class="tier-name">{tier.name as "safe"}</span>
                <span class="amt">
                  <span class="dol">$</span>
                  {tier.amount}
                </span>
                <span class="freq">/ month</span>
              </label>
            ))}

            <label class="tier-chip custom" for="tier-custom">
              <input
                type="radio"
                id="tier-custom"
                name="amount-dollars"
                value="custom"
                required
                checked={hasCustomAmount}
              />
              <span class="idx">{tierIndex(TIERS.length) as "safe"}</span>
              <span class="tier-name">Custom</span>
              <div class="input-row">
                <span class="dol">$</span>
                <label for="custom-amount" class="visually-hidden">
                  Custom monthly donation amount in dollars
                </label>
                <input
                  type="text"
                  inputmode="decimal"
                  name="custom-amount"
                  id="custom-amount"
                  data-min={SubscriptionManager.minimumAmount.cents / 100}
                  class="custom-input"
                  placeholder="0"
                  aria-describedby="custom-amount-monthly-hint"
                  value={
                    hasCustomAmount
                      ? ((existingAmount ?? 0) / 100).toFixed(2)
                      : undefined
                  }
                  required
                  readonly={!hasCustomAmount}
                />
                <span id="custom-amount-monthly-hint" class="visually-hidden">
                  Enter a custom dollar amount for your monthly donation
                </span>
              </div>
              <span class="freq">/ month</span>
            </label>
          </div>
        </fieldset>

        <button type="submit" class="btn btn-primary btn-large">
          {subscription ? "Update Monthly Donation" : "Start Monthly Donation"}
        </button>
      </form>
    </section>
  );
}
