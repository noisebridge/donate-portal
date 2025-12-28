// biome-ignore lint/correctness/noUnusedImports: Html is used by JSX
import Html from "@kitajs/html";
import type Stripe from "stripe";
import { DonationTierSelector } from "~/components/donation-tier-selector";
import { Layout } from "~/components/layout";
import {
  type Notification,
  NotificationContainer,
} from "~/components/notification-container";

export interface ManageProps {
  email: string;
  customer?: Stripe.Customer | undefined;
  subscription?: Stripe.Subscription | undefined;
  notifications?: Notification[];
}

export function ManagePage({
  email,
  customer,
  subscription,
  notifications = [],
}: ManageProps) {
  return (
    <Layout
      title={subscription ? "Manage your Donation" : "Set Up your Donation"}
      styles="manage.css"
      script="manage.mjs"
      isAuthenticated
    >
      <div class="manage-header">
        <h1>{customer ? "Manage your Donation" : "Start a Donation"}</h1>
        <p>
          You're signed in as <strong>{email}</strong>
        </p>
      </div>

      <NotificationContainer notifications={notifications} />

      <DonationTierSelector subscription={subscription} />

      {subscription && (
        <form
          method="POST"
          action="/cancel"
          class="card cancel-subscription-form"
        >
          <p class="form-description">
            If you want to cancel your monthly donation double click the button
            below.
          </p>

          <button type="submit" class="btn btn-secondary btn-large">
            Cancel Monthly Donation
          </button>
        </form>
      )}
    </Layout>
  );
}
