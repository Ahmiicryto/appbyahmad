// In-app purchases through RevenueCat (App Store + Google Play).
//
// The phone app logs in to RevenueCat with our user id as the "app user id", so every RevenueCat
// customer maps 1:1 to a user here. Premium is granted from two directions, both idempotent:
//   1. RevenueCat webhooks (server-to-server, the source of truth over time: renewals, expiry, refunds)
//   2. POST /api/billing/revenuecat/sync right after a purchase/restore, which asks RevenueCat's REST API
//      for the customer's current state (so the app unlocks instantly, without waiting for a webhook).
import { timingSafeEqual } from "node:crypto";
import { one, query } from "../db/pool.js";
import { HttpError, badRequest } from "../lib/errors.js";
import { logger } from "../logger.js";
import { track } from "./activity.js";
import { getSetting } from "./settings.js";

const API = "https://api.revenuecat.com/v1";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Swappable so tests never call RevenueCat.
let fetchImpl = (...args) => fetch(...args);
export const setRevenueCatFetch = (fn) => (fetchImpl = fn);
export const resetRevenueCatFetch = () => (fetchImpl = (...args) => fetch(...args));

const providerFor = (store) => (store === "app_store" || store === "mac_app_store" ? "apple" : store === "play_store" ? "google" : "manual");
// Google products arrive as "product:base-plan"; plans store the product id.
const baseProduct = (id) => String(id || "").split(":")[0];
const subKey = (userId, productId) => `rc:${userId}:${baseProduct(productId)}`;
const LIVE = ["active", "trialing", "past_due"];

export async function storeConfig() {
  const [iosKey, androidKey, entitlement] = await Promise.all([
    getSetting("revenuecat_ios_key"),
    getSetting("revenuecat_android_key"),
    getSetting("revenuecat_entitlement")
  ]);
  return { enabled: Boolean(iosKey || androidKey), iosKey: iosKey || null, androidKey: androidKey || null, entitlement: entitlement || "premium" };
}

// Constant-time compare of the Authorization header RevenueCat sends with the password set in admin.
export async function checkWebhookAuth(header) {
  const expected = await getSetting("revenuecat_webhook_auth");
  if (!expected) return "not_configured";
  const got = String(header || "").replace(/^Bearer\s+/i, "");
  const a = Buffer.from(got);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b) ? "ok" : "bad";
}

async function planIdFor(productId) {
  if (!productId) return null;
  const row =
    (await one("SELECT id FROM plans WHERE store_product_id = $1", [productId])) ||
    (await one("SELECT id FROM plans WHERE store_product_id = $1", [baseProduct(productId)]));
  return row?.id ?? null;
}

async function findUser(ids) {
  for (const id of ids) {
    if (typeof id === "string" && UUID.test(id)) {
      const u = await one("SELECT id FROM users WHERE id = $1", [id]);
      if (u) return u.id;
    }
  }
  return null;
}

// Writes one store subscription and recomputes the user's plan. `eventAt` (ms) guards against out-of-order webhooks.
async function upsertSubscription({ userId, productId, store, status, periodEnd, cancelAtPeriodEnd, amountCents, currency, eventAt }) {
  const key = subKey(userId, productId);
  const before = await one("SELECT status, extract(epoch FROM last_event_at) * 1000 AS last_ms FROM subscriptions WHERE provider_subscription_id = $1", [key]);
  if (before && eventAt && before.last_ms && Number(before.last_ms) > eventAt) {
    logger.info({ key, status }, "revenuecat: skipped an older event");
    return false;
  }
  const planId = await planIdFor(productId);
  await query(
    `INSERT INTO subscriptions (user_id, plan_id, provider, provider_subscription_id, status, amount_cents, currency, current_period_end, cancel_at_period_end, last_event_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
     ON CONFLICT (provider_subscription_id) DO UPDATE SET
       plan_id = coalesce(EXCLUDED.plan_id, subscriptions.plan_id), provider = EXCLUDED.provider, status = EXCLUDED.status,
       amount_cents = coalesce(EXCLUDED.amount_cents, subscriptions.amount_cents), currency = coalesce(EXCLUDED.currency, subscriptions.currency),
       current_period_end = coalesce(EXCLUDED.current_period_end, subscriptions.current_period_end),
       cancel_at_period_end = EXCLUDED.cancel_at_period_end,
       last_event_at = greatest(subscriptions.last_event_at, EXCLUDED.last_event_at), updated_at = now()`,
    [
      userId, planId, providerFor(store), key, status, amountCents ?? null, currency ?? null,
      periodEnd ? new Date(periodEnd) : null, Boolean(cancelAtPeriodEnd), eventAt ? new Date(eventAt) : new Date()
    ]
  );
  const wasLive = before && LIVE.includes(before.status);
  if (LIVE.includes(status) && !wasLive) track(userId, "subscription.started", { plan_id: planId, provider: providerFor(store), status });
  if (!LIVE.includes(status) && wasLive) track(userId, "subscription.canceled", { plan_id: planId, provider: providerFor(store), status });
  await recomputePlan(userId);
  return true;
}

// Premium while any subscription (Stripe or store) is live; expiry = the latest live period end.
export async function recomputePlan(userId) {
  const live = await one(
    `SELECT count(*)::int AS n, bool_or(current_period_end IS NULL) AS forever, max(current_period_end) AS until
       FROM subscriptions WHERE user_id = $1 AND status = ANY($2) AND (current_period_end IS NULL OR current_period_end > now() - interval '1 day')`,
    [userId, LIVE]
  );
  if (live.n > 0) {
    await query("UPDATE users SET plan = 'premium', plan_expires_at = $2 WHERE id = $1", [userId, live.forever ? null : live.until]);
  } else {
    // Never downgrade someone an admin upgraded by hand (premium with no subscription rows at all).
    const any = await one("SELECT 1 AS x FROM subscriptions WHERE user_id = $1 LIMIT 1", [userId]);
    if (any) await query("UPDATE users SET plan = 'free', plan_expires_at = NULL WHERE id = $1", [userId]);
  }
}

// ---------------------------------------------------------------- webhook events

const ACTIVE_TYPES = new Set(["INITIAL_PURCHASE", "RENEWAL", "UNCANCELLATION", "PRODUCT_CHANGE", "NON_RENEWING_PURCHASE", "SUBSCRIPTION_EXTENDED", "TEMPORARY_ENTITLEMENT_GRANT"]);
const PAID_TYPES = new Set(["INITIAL_PURCHASE", "RENEWAL", "NON_RENEWING_PURCHASE"]);

// Returns true when the event changed something.
export async function applyRevenueCatEvent(event) {
  if (!event?.type || event.type === "TEST") return false;
  const userId = await findUser([event.app_user_id, event.original_app_user_id, ...(event.aliases || [])]);
  if (!userId) {
    logger.warn({ type: event.type, app_user_id: event.app_user_id }, "revenuecat: event for unknown user");
    return false;
  }

  // With a secret key, ask RevenueCat for the full current state instead of interpreting the single event.
  if (await getSetting("revenuecat_secret_key")) {
    await syncUser(userId);
    await recordPayment(userId, event);
    return true;
  }

  const productId = event.new_product_id || event.product_id;
  if (!productId) return false;
  const expires = event.expiration_at_ms ?? null;
  const eventAt = event.event_timestamp_ms ?? null;
  const base = { userId, productId, store: event.store, periodEnd: expires, eventAt };
  const price = typeof event.price === "number" && event.price > 0 ? Math.round(event.price * 100) : null;

  let changed = false;
  if (ACTIVE_TYPES.has(event.type)) {
    const status = event.period_type === "TRIAL" ? "trialing" : "active";
    changed = await upsertSubscription({ ...base, status, cancelAtPeriodEnd: false, amountCents: price, currency: price ? "usd" : null });
  } else if (event.type === "CANCELLATION") {
    // Cancelled = won't renew (or refunded). Premium stays until the period ends, unless it was refunded.
    const refunded = event.cancel_reason === "CUSTOMER_SUPPORT" && expires && expires <= Date.now();
    changed = await upsertSubscription({ ...base, status: refunded ? "canceled" : event.period_type === "TRIAL" ? "trialing" : "active", cancelAtPeriodEnd: true });
  } else if (event.type === "BILLING_ISSUE") {
    changed = await upsertSubscription({ ...base, status: "past_due", cancelAtPeriodEnd: false });
  } else if (event.type === "EXPIRATION") {
    changed = await upsertSubscription({ ...base, status: "canceled", cancelAtPeriodEnd: false });
  } else if (event.type === "SUBSCRIPTION_PAUSED") {
    changed = await upsertSubscription({ ...base, status: "active", cancelAtPeriodEnd: true });
  }
  if (changed) await recordPayment(userId, event);
  return changed;
}

async function recordPayment(userId, event) {
  if (!PAID_TYPES.has(event.type) || !(typeof event.price === "number" && event.price > 0) || !event.id) return;
  // RevenueCat reports `price` in USD.
  const amount = Math.round(event.price * 100);
  const provider = providerFor(event.store);
  const row = await one(
    `INSERT INTO payments (user_id, provider, provider_payment_id, amount_cents, currency, status)
     VALUES ($1, $2, $3, $4, 'usd', 'succeeded') ON CONFLICT (provider_payment_id) DO NOTHING RETURNING id`,
    [userId, provider, `rc_${event.id}`, amount]
  );
  if (row) track(userId, "payment.succeeded", { amount_cents: amount, currency: "usd", provider });
}

// ---------------------------------------------------------------- REST sync

async function fetchSubscriber(appUserId) {
  const key = await getSetting("revenuecat_secret_key");
  if (!key) throw badRequest("In-app purchases aren't fully set up yet. Add the RevenueCat secret API key in admin Settings.", "store_not_configured");
  let res;
  try {
    res = await fetchImpl(`${API}/subscribers/${encodeURIComponent(appUserId)}`, {
      headers: { Authorization: `Bearer ${key}`, Accept: "application/json" },
      signal: AbortSignal.timeout(15_000)
    });
  } catch (err) {
    logger.warn({ err: err?.message }, "revenuecat: request failed");
    throw new HttpError(502, "Couldn't reach the App Store service. Try again in a minute.", "store_unreachable");
  }
  if (res.status === 401 || res.status === 403) {
    throw new HttpError(502, "RevenueCat rejected the secret API key. Check it in admin Settings.", "store_auth");
  }
  if (!res.ok) {
    throw new HttpError(502, "The App Store service returned an error. Try again in a minute.", "store_error");
  }
  return (await res.json())?.subscriber ?? {};
}

// Mirrors RevenueCat's view of one customer into subscriptions + users.plan.
export async function syncUser(userId) {
  const sub = await fetchSubscriber(userId);
  const entitlementId = (await getSetting("revenuecat_entitlement")) || "premium";
  const ent = sub.entitlements?.[entitlementId];
  const now = Date.now();
  const products = Object.entries(sub.subscriptions || {});
  // Lifetime / one-time unlock shows up only as an entitlement with no expiry.
  if (ent && !ent.expires_date && !products.some(([id]) => baseProduct(id) === baseProduct(ent.product_identifier))) {
    products.push([ent.product_identifier, { store: ent.store || "app_store", expires_date: null, period_type: "normal" }]);
  }
  for (const [productId, s] of products) {
    const expires = s.expires_date ? Date.parse(s.expires_date) : null;
    const alive = (expires === null || expires > now) && !s.refunded_at;
    const status = !alive ? "canceled" : s.billing_issues_detected_at ? "past_due" : s.period_type === "trial" ? "trialing" : "active";
    await upsertSubscription({
      userId, productId, store: s.store, status, periodEnd: expires,
      cancelAtPeriodEnd: Boolean(s.unsubscribe_detected_at), eventAt: null
    });
  }
  if (!products.length) await recomputePlan(userId);
  return { entitlementActive: Boolean(ent && (!ent.expires_date || Date.parse(ent.expires_date) > now)) };
}
