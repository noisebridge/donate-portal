import type Stripe from "stripe";
import { DonationTierSelector } from "~/components/donation-tier-selector";
import { Layout } from "~/components/layout";
import { type Message, MessageContainer } from "~/components/message-container";
import paths from "~/paths";

export interface ManageProps {
  email: string;
  customer?: Stripe.Customer | undefined;
  subscription?: Stripe.Subscription | undefined;
  messages?: Message[];
}

export function ManagePage({
  email,
  customer,
  subscription,
  messages = [],
}: ManageProps) {
  return (
    <Layout
      title={subscription ? "Manage your Donation" : "Set Up your Donation"}
      styles="manage.css"
      script="manage.mjs"
      isAuthenticated
    >
      <div class="container">
        <div class="manage-header">
          <h1>{customer ? "Manage your Donation" : "Start a Donation"}</h1>
          <p>
            You're signed in as <strong>{email}</strong>
          </p>
        </div>

        <MessageContainer messages={messages} />

        <DonationTierSelector subscription={subscription} />

        {subscription && (
          <form
            method="POST"
            action={paths.cancel()}
            class="card cancel-subscription-form"
          >
            <p class="form-description">
              If you want to cancel your monthly donation double click the
              button below.
            </p>

            <button type="submit" class="btn btn-secondary btn-large">
              Cancel Monthly Donation
            </button>
          </form>
        )}
      </div>
    </Layout>
  );
}
