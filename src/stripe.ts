import Stripe from "stripe";

const secretKey = process.env["STRIPE_SECRET_KEY"];
if (!secretKey) {
  throw new Error("STRIPE_SECRET_KEY env var not set!");
}

const stripe = new Stripe(secretKey);

export default stripe;
