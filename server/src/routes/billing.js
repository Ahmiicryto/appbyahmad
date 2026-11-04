import { Router } from "express";
import { z } from "zod";
import { one, query } from "../db/pool.js";
import { requireAuth } from "../lib/auth.js";
import { badRequest, notFound } from "../lib/errors.js";
import { logger } from "../logger.js";
import { track } from "../services/activity.js";
import { getSetting } from "../services/settings.js";
import { constructEvent, getStripe, requireStripe, stripeFailure, syncPlanToStripe } from "../services/stripe.js";

export const billingRouter = Router();

const PUBLIC_PLAN_COLUMNS = "id, name, description, price_cents, currency, interval, trial_days, features";
// Statuses that keep Premium on, and statuses that end it.
export const LIVE_STATUSES = ["active", "trialing", "past_due"];
export const ENDED_STATUSES = ["canceled", "unpaid", "incomplete_expired"];

const baseUrl = (req) => `${req.protocol}://${req.get("host")}`;

billingRouter.get("/plans", async (req, res) => {
  const { rows } = await query(`SELECT ${PUBLIC_PLAN_COLUMNS} FROM plans WHERE active ORDER BY sort, price_cents`);
  res.json({ plans: rows, paymentsEnabled: Boolean(await getSetting("stripe_secret_key")) });
});

// Page Stripe sends people back to when no custom URL is set. The app's in-app browser just needs something to close.
billingRouter.get("/return", (req, res) => {
  const status = String(req.query.status || "");
  const title =
    status === "success" ? "Payment received" : status === "cancel" ? "Payment cancelled" : "All done";
  const line =
    status === "success"
      ? "Premium will be active in a moment."
      : status === "cancel"
        ? "You weren't charged."
        : "Your changes are saved.";
  res.type("html").send(`<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1"><title>${title}</title>
<style>body{font-family:system-ui,sans-serif;display:grid;place-items:center;min-height:100vh;margin:0;padding:16px;background:#0b0b0c;color:#f4f4f5;text-align:center}p{color:#a1a1aa}</style>
</head><body><main><h1>${title}</h1><p>${line}</p><p>You can close this window and go back to the app.</p></main></body></html>`);
});

billingRouter.use(requireAuth);

billingRouter.get("/me", async (req, res) => {
  const subscription = await one(
    `SELECT s.plan_id, p.name AS plan_name, s.provider, s.status, s.amount_cents, s.currency,
            s.current_period_end, s.cancel_at_period_end, s.updated_at
       FROM subscriptions s LEFT JOIN plans p ON p.id = s.plan_id
      WHERE s.user_id = $1
      ORDER BY (s.status = ANY($2)) DESC, s.updated_at DESC LIMIT 1`,
    [req.user.id, LIVE_STATUSES]
  );
  res.json({ plan: req.user.plan, isPremium: req.user.isPremium, plan_expires_at: req.user.plan_expires_at, subscription });
});

const CheckoutBody = z.object({ plan_id: z.string().trim().min(1).max(40) }).strict();

billingRouter.post("/checkout", async (req, res) => {
  const { plan_id } = CheckoutBody.parse(req.body ?? {});
  const stripe = await requireStripe();
  let plan = await one("SELECT * FROM plans WHERE id = $1", [plan_id]);
  if (!plan) throw notFound("That plan doesn't exist. Pick another plan.");
  if (!plan.active) throw badRequest("That plan is no longer available. Pick another plan.", "plan_inactive");

  const live = await one(
    "SELECT id FROM subscriptions WHERE user_id = $1 AND provider = 'stripe' AND status = ANY($2) LIMIT 1",
    [req.user.id, LIVE_STATUSES]
  );
  if (live) throw badRequest("You already have Premium. Use Manage subscription to change your plan.", "already_subscribed");

  try {
    if (!plan.stripe_price_id) plan = await syncPlanToStripe(plan, { stripe });
  } catch (err) {
    throw stripeFailure(err, "prepare this plan for checkout");
  }

  const [successUrl, cancelUrl] = await Promise.all([getSetting("checkout_success_url"), getSetting("checkout_cancel_url")]);
  const params = (customer) => ({
    mode: "subscription",
    customer,
    line_items: [{ price: plan.stripe_price_id, quantity: 1 }],
    client_reference_id: req.user.id,
    metadata: { user_id: req.user.id, plan_id: plan.id },
    subscription_data: {
      metadata: { user_id: req.user.id, plan_id: plan.id },
      ...(plan.trial_days > 0 ? { trial_period_days: plan.trial_days } : {})
    },
    allow_promotion_codes: true,
    success_url: successUrl || `${baseUrl(req)}/api/billing/return?status=success`,
    cancel_url: cancelUrl || `${baseUrl(req)}/api/billing/return?status=cancel`
  });

  try {
    let customer = await customerFor(stripe, req.user);
    let session;
    try {
      session = await stripe.checkout.sessions.create(params(customer));
    } catch (err) {
      // Saved customer is from another Stripe account (e.g. test key swapped for live): make a fresh one.
      if (err?.code !== "resource_missing" || err?.param !== "customer") throw err;
      customer = await customerFor(stripe, req.user, { fresh: true });
      session = await stripe.checkout.sessions.create(params(customer));
    }
    track(req.user.id, "checkout.started", { plan_id: plan.id });
    res.json({ url: session.url });
  } catch (err) {
    throw stripeFailure(err, "start checkout");
  }
});

billingRouter.post("/portal", async (req, res) => {
  const stripe = await requireStripe();
  const row = await one("SELECT stripe_customer_id FROM users WHERE id = $1", [req.user.id]);
  if (!row?.stripe_customer_id) throw badRequest("You don't have a paid subscription to manage yet.", "no_customer");
  try {
    const session = await stripe.billingPortal.sessions.create({
      customer: row.stripe_customer_id,
      return_url: `${baseUrl(req)}/api/billing/return?status=portal`
    });
    res.json({ url: session.url });
  } catch (err) {
    throw stripeFailure(err, "open subscription settings");
  }
});

async function customerFor(stripe, user, { fresh = false } = {}) {
  if (!fresh) {
    const row = await one("SELECT stripe_customer_id FROM users WHERE id = $1", [user.id]);
    if (row?.stripe_customer_id) return row.stripe_customer_id;
  }
  const customer = await stripe.customers.create({ email: user.email, metadata: { user_id: user.id } });
  await query("UPDATE users SET stripe_customer_id = $2 WHERE id = $1", [user.id, customer.id]);
  return customer.id;
}

// ---------------------------------------------------------------- webhook

// Mounted with express.raw, so req.body is the exact Buffer Stripe signed.
export async function stripeWebhook(req, res) {
  let event;
  try {
    const secret = await getSetting("stripe_webhook_secret");
    if (!secret) {
      return res.status(400).json({ error: { code: "webhook_not_configured", message: "Add the webhook signing secret in Settings → Payments." } });
    }
    try {
      event = constructEvent(req.body, req.get("stripe-signature") || "", secret);
    } catch {
      return res.status(400).json({ error: { code: "bad_signature", message: "Webhook signature didn't match. Check the signing secret in Settings → Payments." } });
    }

    const fresh = await one("INSERT INTO webhook_events (id, type) VALUES ($1, $2) ON CONFLICT (id) DO NOTHING RETURNING id", [event.id, event.type]);
    if (!fresh) return res.json({ received: true, duplicate: true });

    try {
      const handled = await handleEvent(event);
      return res.json({ received: true, handled });
    } catch (err) {
      // Forget the event so Stripe's retry gets processed.
      await query("DELETE FROM webhook_events WHERE id = $1", [event.id]).catch(() => {});
      throw err;
    }
  } catch (err) {
    logger.error({ err, eventId: event?.id, type: event?.type }, "stripe webhook failed");
    if (!res.headersSent) res.status(500).json({ error: { code: "webhook_failed", message: "Couldn't process this event. Stripe will retry." } });
  }
}

async function handleEvent(event) {
  const obj = event.data.object;
  switch (event.type) {
    case "checkout.session.completed":
      await onCheckoutCompleted(obj);
      return true;
    case "customer.subscription.created":
    case "customer.subscription.updated":
    case "customer.subscription.deleted":
      await applySubscription(obj);
      return true;
    case "invoice.paid":
      await recordInvoice(obj, "succeeded");
      return true;
    case "invoice.payment_failed":
      await recordInvoice(obj, "failed");
      return true;
    default:
      return false;
  }
}

const idOf = (v) => (typeof v === "string" ? v : v?.id ?? null);

async function onCheckoutCompleted(session) {
  if (session.mode !== "subscription") return;
  const userId = session.client_reference_id || session.metadata?.user_id;
  const customer = idOf(session.customer);
  if (userId && customer) {
    await query("UPDATE users SET stripe_customer_id = $2 WHERE id = $1 AND stripe_customer_id IS DISTINCT FROM $2", [userId, customer]);
  }
  if (!session.subscription) return;
  let sub = session.subscription;
  if (typeof sub === "string") {
    const stripe = await getStripe();
    if (!stripe) {
      logger.warn({ session: session.id }, "stripe webhook: checkout completed but no secret key to fetch the subscription");
      return;
    }
    sub = await stripe.subscriptions.retrieve(sub);
  }
  await applySubscription(sub, { userId, planId: session.metadata?.plan_id });
}

async function userIdFor(customer, hint) {
  if (hint) {
    const u = await one("SELECT id FROM users WHERE id::text = $1", [hint]);
    if (u) return u.id;
  }
  if (!customer) return null;
  const u = await one("SELECT id FROM users WHERE stripe_customer_id = $1", [customer]);
  return u?.id ?? null;
}

export async function applySubscription(sub, hints = {}) {
  const customer = idOf(sub.customer);
  const userId = await userIdFor(customer, hints.userId || sub.metadata?.user_id);
  if (!userId) {
    logger.warn({ sub: sub.id, customer }, "stripe webhook: subscription for unknown user");
    return;
  }
  if (customer) {
    await query("UPDATE users SET stripe_customer_id = $2 WHERE id = $1 AND stripe_customer_id IS NULL", [userId, customer]).catch(() => {});
  }

  const item = sub.items?.data?.[0];
  const price = item?.price;
  // Newer Stripe API versions keep the period on the item; older ones on the subscription.
  const periodEnd = item?.current_period_end ?? sub.current_period_end ?? null;
  const planHint = hints.planId || sub.metadata?.plan_id || price?.metadata?.plan_id;
  const plan =
    (planHint && (await one("SELECT id FROM plans WHERE id = $1", [planHint]))) ||
    (price?.id && (await one("SELECT id FROM plans WHERE stripe_price_id = $1", [price.id])));
  const planId = plan?.id ?? null;
  const amount = price?.unit_amount != null ? price.unit_amount * (item?.quantity ?? 1) : null;

  const before = await one("SELECT status FROM subscriptions WHERE provider_subscription_id = $1", [sub.id]);
  await query(
    `INSERT INTO subscriptions (user_id, plan_id, provider, provider_subscription_id, status, amount_cents, currency, current_period_end, cancel_at_period_end)
     VALUES ($1, $2, 'stripe', $3, $4, $5, $6, to_timestamp($7), $8)
     ON CONFLICT (provider_subscription_id) DO UPDATE SET
       user_id = EXCLUDED.user_id, plan_id = coalesce(EXCLUDED.plan_id, subscriptions.plan_id), status = EXCLUDED.status,
       amount_cents = coalesce(EXCLUDED.amount_cents, subscriptions.amount_cents), currency = coalesce(EXCLUDED.currency, subscriptions.currency),
       current_period_end = coalesce(EXCLUDED.current_period_end, subscriptions.current_period_end),
       cancel_at_period_end = EXCLUDED.cancel_at_period_end, updated_at = now()`,
    [userId, planId, sub.id, sub.status, amount, price?.currency ?? null, periodEnd, Boolean(sub.cancel_at_period_end)]
  );

  const wasLive = before && LIVE_STATUSES.includes(before.status);
  const wasEnded = before && ENDED_STATUSES.includes(before.status);
  if (LIVE_STATUSES.includes(sub.status)) {
    await query("UPDATE users SET plan = 'premium', plan_expires_at = to_timestamp($2) WHERE id = $1", [userId, periodEnd]);
    if (!wasLive) track(userId, "subscription.started", { plan_id: planId, status: sub.status });
  } else if (ENDED_STATUSES.includes(sub.status)) {
    // Another live subscription (e.g. switched plans) keeps Premium on.
    const other = await one(
      "SELECT id FROM subscriptions WHERE user_id = $1 AND provider_subscription_id <> $2 AND status = ANY($3) LIMIT 1",
      [userId, sub.id, LIVE_STATUSES]
    );
    if (!other) await query("UPDATE users SET plan = 'free', plan_expires_at = NULL WHERE id = $1", [userId]);
    if (!wasEnded) track(userId, "subscription.canceled", { plan_id: planId, status: sub.status });
  }
}

async function recordInvoice(invoice, status) {
  const customer = idOf(invoice.customer);
  const userId = await userIdFor(customer, invoice.parent?.subscription_details?.metadata?.user_id || invoice.metadata?.user_id);
  const amount = status === "succeeded" ? invoice.amount_paid : invoice.amount_due;
  // $0 invoices (trial start) aren't payments.
  if (status === "succeeded" && !amount) return;
  await query(
    `INSERT INTO payments (user_id, provider, provider_payment_id, amount_cents, currency, status)
     VALUES ($1, 'stripe', $2, $3, $4, $5)
     ON CONFLICT (provider_payment_id) DO UPDATE SET status = EXCLUDED.status, amount_cents = EXCLUDED.amount_cents`,
    [userId, invoice.id, amount ?? 0, invoice.currency || "usd", status]
  );
  if (userId) track(userId, status === "succeeded" ? "payment.succeeded" : "payment.failed", { amount_cents: amount ?? 0, currency: invoice.currency });
}
