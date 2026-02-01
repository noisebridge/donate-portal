#!/usr/bin/env bun

import dotenv from "dotenv";

dotenv.config({ path: `${__dirname}/../.env` });

async function cleanUpTestData() {
  const stripe = (await import("~/services/stripe")).default;

  console.log("Searching for subscriptions with e2e-test emails...\n");

  let totalCancelled = 0;
  let totalSkipped = 0;
  let hasMore = true;
  let startingAfter: string | undefined;

  while (hasMore) {
    // List all subscriptions (both active and canceled)
    const subscriptions = await stripe.subscriptions.list({
      status: "active",
      limit: 100,
      // biome-ignore lint/style/noNonNullAssertion: Bad type check
      starting_after: startingAfter!,
      expand: ["data.customer"],
    });

    for (const subscription of subscriptions.data) {
      // Get customer email
      const customer = subscription.customer;
      if (typeof customer === "string") {
        console.warn(
          `⚠ Subscription ${subscription.id} has unexpanded customer`,
        );
        continue;
      }
      if (!("email" in customer)) {
        console.warn("Deleted customer");
        continue;
      }

      const email = customer.email;
      if (!email) {
        console.log(`⊘ Subscription ${subscription.id} has no email, skipping`);
        totalSkipped++;
        continue;
      }

      // Check if email starts with e2e-test
      if (!email.startsWith("e2e-test")) {
        continue;
      }

      // Cancel the subscription
      console.log(
        `✓ Canceling subscription ${subscription.id} for ${email} (status: ${subscription.status})`,
      );

      try {
        await stripe.subscriptions.cancel(subscription.id);
        await stripe.customers.del(customer.id);
        totalCancelled++;
      } catch (error) {
        console.error(
          `✗ Failed to cancel subscription ${subscription.id}: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }

    hasMore = subscriptions.has_more;
    if (hasMore && subscriptions.data.length > 0) {
      startingAfter = subscriptions.data[subscriptions.data.length - 1]?.id;
    }
  }

  console.log("\n");
  console.log("=".repeat(50));
  console.log(`Cancellation complete!`);
  console.log(`  Subscriptions canceled: ${totalCancelled}`);
  console.log(`  Subscriptions skipped: ${totalSkipped}`);
  console.log("=".repeat(50));
}

await cleanUpTestData();
