import type Stripe from "stripe";
import paths from "~/paths";

interface Tier {
  id: string;
  name: string;
  amount: number;
}

const TIERS: Tier[] = [
  { id: "starving", name: "Starving Hacker", amount: 50 },
  { id: "employed", name: "Employed Hacker", amount: 100 },
  { id: "rich", name: "Rich Hacker", amount: 200 },
];

interface DonationTierSelectorProps {
  subscription?: Stripe.Subscription | undefined;
}

function tierChecked(tier: Tier, existingAmount: number | null): boolean {
  if (!existingAmount) {
    return tier.id === "employed";
  }

  return tier.amount === existingAmount / 100;
}

function subscriptionRenewalDate(subscription?: Stripe.Subscription) {
  if (!subscription) {
    return null;
  }

  const item = subscription.items.data[0];
  if (!item) {
    return null;
  }

  return new Date(item.current_period_end * 1000);
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
  const hasCustomAmount = tiers.find((tier) => tier.checked) === undefined;
  const renewalDate =
    subscriptionRenewalDate(subscription)?.toLocaleDateString();

  return (
    <form method="POST" action={paths.subscribe()} class="donation-tier-form">
      <p class="form-description">
        {renewalDate
          ? `Your monthly donation renews on ${renewalDate}`
          : "Choose a monthly donation tier to support Noisebridge"}
      </p>

      <div class="tier-options">
        {tiers.map((tier) => (
          <label class="tier-card" for={`tier-${tier.id}`}>
            <input
              type="radio"
              id={`tier-${tier.id}`}
              name="amount-dollars"
              value={tier.amount.toString()}
              required
              checked={tier.checked}
            />
            <div class="tier-content">
              <h3 class="tier-name">{tier.name}</h3>
              <div class="tier-amount">
                <span class="currency">$</span>
                <span class="amount">{tier.amount}</span>
                <span class="period">/month</span>
              </div>
            </div>
            <div class="tier-checkmark">
              <img src="/assets/image/checkmark.svg" alt="Selected" />
            </div>
          </label>
        ))}

        <label class="tier-card tier-card-custom" for="tier-custom">
          <input
            type="radio"
            id="tier-custom"
            name="amount-dollars"
            value="custom"
            required
            checked={hasCustomAmount}
          />
          <div class="tier-content">
            <h3 class="tier-name">Custom Amount</h3>
            <div class="custom-amount-input">
              <span class="currency">$</span>
              <input
                type="text"
                inputmode="numeric"
                name="custom-amount"
                id="custom-amount"
                min="5"
                step="1"
                class="custom-input"
                placeholder="0.00"
                value={
                  hasCustomAmount
                    ? ((existingAmount ?? 0) / 100).toFixed(2)
                    : undefined
                }
              />
              <span class="period">/month</span>
            </div>
          </div>
          <div class="tier-checkmark">
            <img src="/assets/image/checkmark.svg" alt="Selected" />
          </div>
        </label>
      </div>

      <button type="submit" class="btn btn-primary btn-large">
        {subscription ? "Update Monthly Donation" : "Start Monthly Donation"}
      </button>

      {subscription && (
        <a href={paths.stripePortal()} class="btn btn-outline btn-large mt-md">
          Past Invoices and Payment Methods
        </a>
      )}
    </form>
  );
}
