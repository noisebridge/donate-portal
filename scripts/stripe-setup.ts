#!/usr/bin/env bun

import dotenv from "dotenv";
dotenv.config({ path: `${__dirname}/../.env` });

const PRODUCT_ID = "monthly_donation";
const PRODUCT_NAME = "Monthly Donation";

async function setupStripeProduct() {
  const stripe = (await import("../src/services/stripe")).default;

  try {
    console.log(`Checking if product "${PRODUCT_NAME}" (${PRODUCT_ID}) already exists...`);

    // Try to retrieve the product by its ID
    try {
      const existingProduct = await stripe.products.retrieve(PRODUCT_ID);
      console.log(`✓ Product already exists: ${existingProduct.name} (${existingProduct.id})`);
      console.log(`  Active: ${existingProduct.active}`);
      console.log(`  Description: ${existingProduct.description || 'N/A'}`);
      return;
    } catch (error: any) {
      // If product doesn't exist, Stripe will throw an error
      if (error.type === 'StripeInvalidRequestError' && error.code === 'resource_missing') {
        console.log('Product does not exist. Creating...');
      } else {
        throw error;
      }
    }

    // Create the product with a vanity ID
    const product = await stripe.products.create({
      id: PRODUCT_ID,
      name: PRODUCT_NAME,
      description: "Monthly recurring donation to support Noisebridge",
      active: true,
    });

    console.log(`✓ Successfully created product: ${product.name} (${product.id})`);
    console.log(`  Active: ${product.active}`);
    console.log(`  Description: ${product.description}`);
  } catch (error) {
    console.error('Error setting up Stripe product:', error);
    process.exit(1);
  }
}

setupStripeProduct();
