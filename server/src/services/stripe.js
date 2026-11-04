import Stripe from "stripe";
import { one } from "../db/pool.js";
import { HttpError, badRequest } from "../lib/errors.js";
import { logger } from "../logger.js";
import { getSetting } from "./settings.js";

export const NOT_CONFIGURED = "Payments aren't set up yet. Try again later.";

// One client per secret key: when an admin changes the key in Settings, the next call builds a new client.
let cached = { key: null, client: null };
let testClient = null;

// Tests inject a fake client so nothing ever reaches the Stripe API. Pass null to reset.
export function setStripeClientForTests(client) {
  testClient = client;
}

// Returns the Stripe client, or null when no secret key is saved.
export async function getStripe() {
  if (testClient) return testClient;
  const key = await getSetting("stripe_secret_key");
  if (!key) return null;
  if (cached.key !== key) {
    cached = { key, client: new Stripe(key, { maxNetworkRetries: 2, timeout: 20_000, appInfo: { name: "appbyahmad" } }) };
  }
  return cached.client;
}

export async function requireStripe() {
  const stripe = await getStripe();
  if (!stripe) throw badRequest(NOT_CONFIGURED, "payments_not_configured");
  return stripe;
}

// 'test' | 'live' | null, from the key prefix (sk_test_…, rk_live_…).
export function keyMode(key) {
  const m = /^(?:sk|rk)_(test|live)_/.exec(key || "");
  return m ? m[1] : null;
}

// Signature check needs only the webhook secret, not the API key.
export function constructEvent(rawBody, header, secret) {
  return Stripe.webhooks.constructEvent(rawBody, header, secret);
}

// Turns a Stripe API failure into a clear 502 instead of a generic 500.
export function stripeFailure(err, what) {
  if (err instanceof HttpError) return err;
  logger.warn({ err: err?.message, code: err?.code, type: err?.type }, `stripe: ${what} failed`);
  const detail = err?.message ? ` Stripe said: ${err.message}` : "";
  return new HttpError(502, `Couldn't ${what}.${detail}`, "stripe_error");
}

// Stable product id per plan, so we never need to store it: the plan id is enough to find it again.
export const productIdFor = (planId) => `plan_${planId}`;

async function ensureProduct(stripe, plan) {
  const id = productIdFor(plan.id);
  const fields = { name: plan.name, ...(plan.description ? { description: plan.description } : {}), metadata: { plan_id: plan.id } };
  try {
    await stripe.products.retrieve(id);
    await stripe.products.update(id, fields);
  } catch (err) {
    if (err?.code !== "resource_missing" && err?.statusCode !== 404) throw err;
    await stripe.products.create({ id, ...fields });
  }
  return id;
}

/**
 * Makes sure the plan exists in Stripe as a Product + recurring Price and stores the price id.
 * Stripe prices can't be edited, so `newPrice: true` (or a plan with no price yet) creates a new Price.
 * The old Price is archived: existing subscribers keep paying it, new checkouts use the new one.
 * Returns the updated plan row.
 */
export async function syncPlanToStripe(plan, { newPrice = false, stripe } = {}) {
  stripe ??= await requireStripe();
  const product = await ensureProduct(stripe, plan);
  if (plan.stripe_price_id && !newPrice) return plan;
  const price = await stripe.prices.create({
    product,
    unit_amount: plan.price_cents,
    currency: plan.currency,
    recurring: { interval: plan.interval },
    metadata: { plan_id: plan.id }
  });
  if (plan.stripe_price_id && plan.stripe_price_id !== price.id) {
    await stripe.prices.update(plan.stripe_price_id, { active: false }).catch((err) =>
      logger.warn({ err: err.message, price: plan.stripe_price_id }, "stripe: could not archive old price")
    );
  }
  return one("UPDATE plans SET stripe_price_id = $2, updated_at = now() WHERE id = $1 RETURNING *", [plan.id, price.id]);
}
