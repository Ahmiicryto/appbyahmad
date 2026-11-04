import { Router } from "express";
import { z } from "zod";
import { one, query } from "../db/pool.js";
import { requireAdmin, requireAuth } from "../lib/auth.js";
import { HttpError, notFound } from "../lib/errors.js";
import { logger } from "../logger.js";
import { audit } from "../services/audit.js";
import { getSetting } from "../services/settings.js";
import { getStripe, keyMode, syncPlanToStripe } from "../services/stripe.js";

export const adminBillingRouter = Router();
adminBillingRouter.use(requireAuth, requireAdmin);

const PlanFields = {
  name: z.string().trim().min(1, "Add a name").max(80),
  description: z.string().trim().max(300).nullable(),
  price_cents: z.number().int().min(0).max(10_000_000),
  currency: z.string().trim().toLowerCase().regex(/^[a-z]{3}$/, "Use a 3-letter currency code like usd"),
  interval: z.enum(["month", "year"]),
  trial_days: z.number().int().min(0).max(90),
  features: z.array(z.string().trim().min(1).max(120)).max(20),
  active: z.boolean(),
  sort: z.number().int().min(-1000).max(1000)
};

const PlanCreate = z
  .object({
    id: z.string().trim().regex(/^[a-z0-9_-]{2,40}$/, "2–40 lowercase letters, numbers, - or _"),
    ...PlanFields,
    description: PlanFields.description.optional(),
    currency: PlanFields.currency.default("usd"),
    trial_days: PlanFields.trial_days.default(0),
    features: PlanFields.features.default([]),
    active: PlanFields.active.default(true),
    sort: PlanFields.sort.default(0)
  })
  .strict();

const PlanUpdate = z
  .object(PlanFields)
  .partial()
  .strict()
  .refine((v) => Object.keys(v).length > 0, "Change at least one field");

const PRICE_FIELDS = ["price_cents", "currency", "interval"];
const EDITABLE = Object.keys(PlanFields);

// Push the plan to Stripe when a key is set. Never fails the save; the reason is returned for the admin.
async function syncIfConfigured(plan, newPrice) {
  const stripe = await getStripe();
  if (!stripe) return { plan, stripe: "not_configured" };
  try {
    return { plan: await syncPlanToStripe(plan, { newPrice, stripe }), stripe: "synced" };
  } catch (err) {
    logger.warn({ err: err.message, plan: plan.id }, "stripe: plan sync failed");
    return { plan, stripe: "failed", stripeError: `Saved, but Stripe didn't accept it: ${err.message}. Checkout will try again.` };
  }
}

adminBillingRouter.get("/plans", async (req, res) => {
  const { rows } = await query(
    `SELECT p.*, (SELECT count(*)::int FROM subscriptions s WHERE s.plan_id = p.id AND s.status IN ('active', 'trialing', 'past_due')) AS subscribers
       FROM plans p ORDER BY p.active DESC, p.sort, p.price_cents`
  );
  res.json({ plans: rows });
});

adminBillingRouter.post("/plans", async (req, res) => {
  const f = PlanCreate.parse(req.body ?? {});
  if (await one("SELECT 1 FROM plans WHERE id = $1", [f.id])) {
    throw new HttpError(409, `A plan with the id "${f.id}" already exists. Pick another id.`, "plan_exists");
  }
  const created = await one(
    `INSERT INTO plans (id, name, description, price_cents, currency, interval, trial_days, features, active, sort)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *`,
    [f.id, f.name, f.description || null, f.price_cents, f.currency, f.interval, f.trial_days, JSON.stringify(f.features), f.active, f.sort]
  );
  await audit(req.user.id, "plan.create", "plan", created.id, { after: pick(created, EDITABLE) });
  const result = await syncIfConfigured(created, false);
  res.status(201).json(result);
});

adminBillingRouter.patch("/plans/:id", async (req, res) => {
  const before = await one("SELECT * FROM plans WHERE id = $1", [req.params.id]);
  if (!before) throw notFound("Plan not found.");
  const f = PlanUpdate.parse(req.body ?? {});
  if ("description" in f) f.description = f.description || null;
  const changed = Object.keys(f).filter((k) => JSON.stringify(f[k]) !== JSON.stringify(before[k]));
  if (!changed.length) return res.json({ plan: before, stripe: "unchanged" });

  const sets = changed.map((k, i) => `${k} = $${i + 2}`);
  const values = changed.map((k) => (k === "features" ? JSON.stringify(f[k]) : f[k]));
  const priceChanged = changed.some((k) => PRICE_FIELDS.includes(k));
  const updated = await one(
    `UPDATE plans SET ${sets.join(", ")}, updated_at = now() WHERE id = $1 RETURNING *`,
    [before.id, ...values]
  );
  await audit(req.user.id, priceChanged ? "plan.price_change" : changed.includes("active") && !f.active ? "plan.archive" : "plan.update", "plan", before.id, {
    before: pick(before, changed),
    after: pick(updated, changed)
  });

  // Only touch Stripe when something it knows about changed.
  const stripeRelevant = priceChanged || changed.includes("name") || changed.includes("description");
  if (!stripeRelevant) return res.json({ plan: updated, stripe: "unchanged" });
  const result = await syncIfConfigured(updated, priceChanged && Boolean(updated.stripe_price_id));
  if (result.stripe === "failed" && priceChanged && updated.stripe_price_id) {
    // Don't keep charging the old price for new checkouts; checkout creates the new price instead.
    result.plan = await one("UPDATE plans SET stripe_price_id = NULL WHERE id = $1 RETURNING *", [updated.id]);
  }
  res.json(result);
});

adminBillingRouter.get("/status", async (req, res) => {
  const [key, webhookSecret] = await Promise.all([getSetting("stripe_secret_key"), getSetting("stripe_webhook_secret")]);
  res.json({
    stripeConfigured: Boolean(key),
    webhookConfigured: Boolean(webhookSecret),
    mode: keyMode(key),
    webhookUrl: `${req.protocol}://${req.get("host")}/api/billing/webhook`,
    webhookEvents: [
      "checkout.session.completed",
      "customer.subscription.created",
      "customer.subscription.updated",
      "customer.subscription.deleted",
      "invoice.paid",
      "invoice.payment_failed"
    ]
  });
});

adminBillingRouter.get("/overview", async (req, res) => {
  // MRR: yearly plans count as 1/12 of their price. Assumes one currency.
  const totals = await one(`
    SELECT
      (SELECT coalesce(round(sum(CASE WHEN p.interval = 'year' THEN s.amount_cents / 12.0 ELSE s.amount_cents END)), 0)::int
         FROM subscriptions s LEFT JOIN plans p ON p.id = s.plan_id
        WHERE s.status IN ('active', 'trialing') AND s.amount_cents IS NOT NULL) AS mrr_cents,
      (SELECT count(*)::int FROM subscriptions WHERE status = 'active') AS active,
      (SELECT count(*)::int FROM subscriptions WHERE status = 'trialing') AS trialing,
      (SELECT count(*)::int FROM subscriptions WHERE status = 'past_due') AS past_due,
      (SELECT count(*)::int FROM subscriptions WHERE status IN ('canceled', 'unpaid', 'incomplete_expired') AND updated_at > now() - interval '30 days') AS canceled_30d,
      (SELECT coalesce(sum(amount_cents), 0)::bigint FROM payments WHERE status = 'succeeded' AND created_at > now() - interval '30 days') AS revenue_30d_cents,
      (SELECT count(*)::int FROM payments WHERE status = 'failed' AND created_at > now() - interval '30 days') AS failed_30d
  `);
  const { rows: revenue } = await query(`
    SELECT to_char(d, 'YYYY-MM-DD') AS day, coalesce(sum(pay.amount_cents), 0)::int AS cents
      FROM generate_series(current_date - 29, current_date, interval '1 day') d
      LEFT JOIN payments pay ON pay.created_at::date = d::date AND pay.status = 'succeeded'
     GROUP BY d ORDER BY d`);
  const { rows: payments } = await query(`
    SELECT pay.id, pay.user_id, u.email, pay.amount_cents, pay.currency, pay.status, pay.provider, pay.created_at
      FROM payments pay LEFT JOIN users u ON u.id = pay.user_id
     ORDER BY pay.created_at DESC LIMIT 50`);
  const { rows: subscribers } = await query(`
    SELECT s.id, s.user_id, u.email, s.plan_id, p.name AS plan_name, s.provider, s.status, s.amount_cents, s.currency,
           s.current_period_end, s.cancel_at_period_end, s.created_at
      FROM subscriptions s JOIN users u ON u.id = s.user_id LEFT JOIN plans p ON p.id = s.plan_id
     WHERE s.status IN ('active', 'trialing', 'past_due')
     ORDER BY s.created_at DESC LIMIT 200`);
  res.json({ totals: { ...totals, revenue_30d_cents: Number(totals.revenue_30d_cents) }, revenue, payments, subscribers });
});

function pick(obj, keys) {
  return Object.fromEntries(keys.map((k) => [k, obj[k]]));
}
