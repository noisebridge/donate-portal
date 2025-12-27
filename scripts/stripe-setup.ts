#!/usr/bin/env bun

import dotenv from "dotenv";
import Stripe from "stripe";

dotenv.config({ path: `${__dirname}/../.env` });

const PRODUCT_ID = "monthly_donation";
const PRODUCT_NAME = "Monthly Donation";

async function setupStripeProduct(stripe: Stripe) {
  console.log(
    `Checking if product "${PRODUCT_NAME}" (${PRODUCT_ID}) already exists...`,
  );

  try {
    const existingProduct = await stripe.products.retrieve(PRODUCT_ID);
    console.log(
      `✓ Product already exists: ${existingProduct.name} (${existingProduct.id})`,
    );
    console.log(`  Active: ${existingProduct.active}`);
    console.log(`  Description: ${existingProduct.description || "N/A"}`);
    return;
  } catch (error: unknown) {
    if (
      error instanceof Stripe.errors.StripeError &&
      error.type === "StripeInvalidRequestError" &&
      error.code === "resource_missing"
    ) {
      console.log("Product does not exist. Creating...");
    } else {
      throw error;
    }
  }

  const product = await stripe.products.create({
    id: PRODUCT_ID,
    name: PRODUCT_NAME,
    description: "Monthly recurring donation to support Noisebridge",
    active: true,
  });

  console.log(
    `✓ Successfully created product: ${product.name} (${product.id})`,
  );
  console.log(`  Active: ${product.active}`);
  console.log(`  Description: ${product.description}`);
}

const PORTAL_HEADLINE = "Manage your Noisebridge donation";

async function setupBillingPortalConfiguration(stripe: Stripe) {
  console.log("Checking for existing billing portal configuration...");

  // List existing configurations
  const configs = await stripe.billingPortal.configurations.list({
    limit: 100,
  });

  // Check if one exists with our settings
  const existing = configs.data.find(
    (config) => config.business_profile.headline === PORTAL_HEADLINE,
  );

  if (existing) {
    console.log(`✓ Configuration already exists: ${existing.id}`);
    return;
  }

  console.log("Creating new billing portal configuration...");

  const configuration = await stripe.billingPortal.configurations.create({
    features: {
      subscription_cancel: {
        enabled: false,
      },
    },
    business_profile: {
      headline: PORTAL_HEADLINE,
    },
  });

  console.log(
    `✓ Successfully created billing portal configuration: ${configuration.id}`,
  );
}

async function main() {
  const stripe = (await import("~/services/stripe")).default;
  await setupStripeProduct(stripe);
  await setupBillingPortalConfiguration(stripe);
}

main().catch((error) => console.error("Setup failed", error));
