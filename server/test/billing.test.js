import assert from "node:assert/strict";
import { after, afterEach, before, describe, test } from "node:test";
import Stripe from "stripe";
import { adminSession, api, pool, resetDb, signup } from "./helpers.js";
import { setSetting } from "../src/services/settings.js";
import { setStripeClientForTests } from "../src/services/stripe.js";

const WHSEC = "whsec_test_secret_for_billing_tests";

before(resetDb);
after(() => pool.end());

async function clearStripeSettings() {
  setStripeClientForTests(null);
  for (const k of ["stripe_secret_key", "stripe_webhook_secret"]) await setSetting(k, null);
}

// A fake Stripe client: records calls, never touches the network.
function fakeStripe(overrides = {}) {
  const calls = [];
  const rec = (name, result) => async (...args) => {
    calls.push([name, ...args]);
    return typeof result === "function" ? result(...args) : result;
  };
  let priceN = 0;
  const client = {
    calls,
    products: {
      retrieve: rec("products.retrieve", () => {
        const e = new Error("No such product");
        e.code = "resource_missing";
        throw e;
      }),
      create: rec("products.create", (p) => ({ id: p.id })),
      update: rec("products.update", (id) => ({ id }))
    },
    prices: {
      create: rec("prices.create", () => ({ id: `price_fake_${++priceN}` })),
      update: rec("prices.update", (id) => ({ id }))
    },
    customers: { create: rec("customers.create", () => ({ id: "cus_fake_1" })) },
    checkout: { sessions: { create: rec("checkout.sessions.create", () => ({ id: "cs_fake", url: "https://checkout.stripe.test/cs_fake" })) } },
    billingPortal: { sessions: { create: rec("billingPortal.sessions.create", () => ({ url: "https://billing.stripe.test/p" })) } },
    subscriptions: { retrieve: rec("subscriptions.retrieve", (id) => subscription({ id })) },
    ...overrides
  };
  return client;
}

function subscription({ id = "sub_1", userId, customer = "cus_hook", status = "active", planId = "premium_monthly", amount = 1299, periodEnd } = {}) {
  return {
    id,
    object: "subscription",
    customer,
    status,
    cancel_at_period_end: false,
    metadata: userId ? { user_id: userId, plan_id: planId } : {},
    items: {
      data: [
        {
          quantity: 1,
          current_period_end: periodEnd ?? Math.floor(Date.now() / 1000) + 30 * 86400,
          price: { id: "price_x", unit_amount: amount, currency: "usd", recurring: { interval: "month" }, metadata: {} }
        }
      ]
    }
  };
}

let evN = 0;
function sendEvent(type, object, { id = `evt_${++evN}`, secret = WHSEC } = {}) {
  const payload = JSON.stringify({ id, object: "event", type, data: { object } });
  const header = Stripe.webhooks.generateTestHeaderString({ payload, secret });
  return api().post("/api/billing/webhook").set({ "Content-Type": "application/json", "Stripe-Signature": header }).send(payload);
}

const userRow = (id) => pool.query("SELECT plan, plan_expires_at, stripe_customer_id FROM users WHERE id = $1", [id]).then((r) => r.rows[0]);

describe("public plans", () => {
  afterEach(clearStripeSettings);

  test("lists active plans sorted, with paymentsEnabled", async () => {
    const r = await api().get("/api/billing/plans").expect(200);
    assert.equal(r.body.paymentsEnabled, false);
    assert.deepEqual(r.body.plans.map((p) => p.id), ["premium_yearly", "premium_monthly"]);
    assert.equal(r.body.plans[0].stripe_price_id, undefined);
    assert.ok(Array.isArray(r.body.plans[0].features));

    await setSetting("stripe_secret_key", "sk_test_fake_key_123");
    const r2 = await api().get("/api/billing/plans").expect(200);
    assert.equal(r2.body.paymentsEnabled, true);
  });
});

describe("admin plans", () => {
  afterEach(clearStripeSettings);

  test("non-admins are refused", async () => {
    const { auth } = await signup();
    await api().get("/api/admin/billing/plans").set(auth).expect(403);
    await api().get("/api/admin/billing/plans").expect(401);
  });

  test("create, edit, archive — all audited, archived plans hidden from the app", async () => {
    const { auth } = await adminSession();
    const c = await api()
      .post("/api/admin/billing/plans")
      .set(auth)
      .send({ id: "lifetime_test", name: "Family", price_cents: 1999, interval: "month", features: ["Up to 5 people"], sort: 5 })
      .expect(201);
    assert.equal(c.body.plan.id, "lifetime_test");
    assert.equal(c.body.stripe, "not_configured");
    await api().post("/api/admin/billing/plans").set(auth).send({ id: "lifetime_test", name: "Dup", price_cents: 1, interval: "month" }).expect(409);
    await api().post("/api/admin/billing/plans").set(auth).send({ id: "Bad Id", name: "X", price_cents: 1, interval: "month" }).expect(400);

    const u = await api().patch("/api/admin/billing/plans/lifetime_test").set(auth).send({ name: "Family plan", trial_days: 14 }).expect(200);
    assert.equal(u.body.plan.name, "Family plan");
    assert.equal(u.body.plan.trial_days, 14);
    await api().patch("/api/admin/billing/plans/lifetime_test").set(auth).send({ trial_days: 500 }).expect(400);
    await api().patch("/api/admin/billing/plans/lifetime_test").set(auth).send({ stripe_price_id: "x" }).expect(400);
    await api().patch("/api/admin/billing/plans/nope").set(auth).send({ name: "x" }).expect(404);

    let pub = await api().get("/api/billing/plans").expect(200);
    assert.ok(pub.body.plans.some((p) => p.id === "lifetime_test"));

    await api().patch("/api/admin/billing/plans/lifetime_test").set(auth).send({ active: false }).expect(200);
    pub = await api().get("/api/billing/plans").expect(200);
    assert.ok(!pub.body.plans.some((p) => p.id === "lifetime_test"));
    const all = await api().get("/api/admin/billing/plans").set(auth).expect(200);
    assert.equal(all.body.plans.find((p) => p.id === "lifetime_test").active, false);

    const { rows } = await pool.query("SELECT action FROM audit_log WHERE target_type = 'plan' AND target_id = 'lifetime_test' ORDER BY id");
    assert.deepEqual(rows.map((r) => r.action), ["plan.create", "plan.update", "plan.archive"]);
  });

  test("a price change with Stripe configured creates a new Stripe price and archives the old one", async () => {
    const { auth } = await adminSession();
    await pool.query("UPDATE plans SET stripe_price_id = 'price_old' WHERE id = 'premium_monthly'");
    const fake = fakeStripe();
    setStripeClientForTests(fake);
    const r = await api().patch("/api/admin/billing/plans/premium_monthly").set(auth).send({ price_cents: 1499 }).expect(200);
    assert.equal(r.body.stripe, "synced");
    assert.match(r.body.plan.stripe_price_id, /^price_fake_/);
    const priceCreate = fake.calls.find((c) => c[0] === "prices.create")[1];
    assert.equal(priceCreate.unit_amount, 1499);
    assert.deepEqual(priceCreate.recurring, { interval: "month" });
    assert.ok(fake.calls.some((c) => c[0] === "prices.update" && c[1] === "price_old" && c[2].active === false));
    const { rows } = await pool.query("SELECT details FROM audit_log WHERE action = 'plan.price_change' ORDER BY id DESC LIMIT 1");
    assert.equal(rows[0].details.after.price_cents, 1499);
    await pool.query("UPDATE plans SET price_cents = 1299, stripe_price_id = NULL WHERE id = 'premium_monthly'");
  });

  test("status reports configuration and mode", async () => {
    const { auth } = await adminSession();
    let s = await api().get("/api/admin/billing/status").set(auth).expect(200);
    assert.equal(s.body.stripeConfigured, false);
    assert.equal(s.body.mode, null);
    assert.match(s.body.webhookUrl, /\/api\/billing\/webhook$/);
    await setSetting("stripe_secret_key", "sk_live_fake_key_123");
    await setSetting("stripe_webhook_secret", WHSEC);
    s = await api().get("/api/admin/billing/status").set(auth).expect(200);
    assert.equal(s.body.stripeConfigured, true);
    assert.equal(s.body.webhookConfigured, true);
    assert.equal(s.body.mode, "live");
  });
});

describe("checkout", () => {
  afterEach(clearStripeSettings);

  test("returns a clear 400 when Stripe isn't configured", async () => {
    const { auth } = await signup();
    const r = await api().post("/api/billing/checkout").set(auth).send({ plan_id: "premium_monthly" }).expect(400);
    assert.equal(r.body.error.message, "Payments aren't set up yet. Try again later.");
    await api().post("/api/billing/checkout").send({ plan_id: "premium_monthly" }).expect(401);
    await api().post("/api/billing/portal").set(auth).expect(400);
  });

  test("with a (fake) Stripe client: syncs the plan, creates a customer and a subscription session", async () => {
    const { auth, user } = await signup();
    const fake = fakeStripe();
    setStripeClientForTests(fake);
    const r = await api().post("/api/billing/checkout").set(auth).send({ plan_id: "premium_yearly" }).expect(200);
    assert.equal(r.body.url, "https://checkout.stripe.test/cs_fake");
    const params = fake.calls.find((c) => c[0] === "checkout.sessions.create")[1];
    assert.equal(params.mode, "subscription");
    assert.equal(params.customer, "cus_fake_1");
    assert.equal(params.client_reference_id, user.id);
    assert.deepEqual(params.metadata, { user_id: user.id, plan_id: "premium_yearly" });
    assert.equal(params.subscription_data.trial_period_days, 7);
    assert.match(params.line_items[0].price, /^price_fake_/);
    assert.match(params.success_url, /\/api\/billing\/return\?status=success$/);
    assert.equal((await userRow(user.id)).stripe_customer_id, "cus_fake_1");

    await pool.query("UPDATE plans SET active = false WHERE id = 'premium_monthly'");
    const inactive = await api().post("/api/billing/checkout").set(auth).send({ plan_id: "premium_monthly" }).expect(400);
    assert.equal(inactive.body.error.code, "plan_inactive");
    await pool.query("UPDATE plans SET active = true, stripe_price_id = NULL");
    await pool.query("UPDATE users SET stripe_customer_id = NULL WHERE id = $1", [user.id]);
  });

  test("return page tells people to go back to the app", async () => {
    const r = await api().get("/api/billing/return?status=success").expect(200);
    assert.match(r.text, /You can close this window and go back to the app/);
  });
});

describe("webhook", () => {
  before(async () => {
    await setSetting("stripe_secret_key", "sk_test_fake_key_123");
    await setSetting("stripe_webhook_secret", WHSEC);
  });
  after(clearStripeSettings);

  test("bad signature is rejected", async () => {
    await sendEvent("customer.subscription.updated", subscription(), { secret: "whsec_wrong" }).expect(400);
    await api().post("/api/billing/webhook").set("Content-Type", "application/json").send("{}").expect(400);
  });

  test("checkout.session.completed makes the user premium", async () => {
    const { user, auth } = await signup();
    const fake = fakeStripe({ subscriptions: { retrieve: async (id) => subscription({ id, userId: user.id, customer: "cus_a", status: "trialing" }) } });
    setStripeClientForTests(fake);
    await sendEvent("checkout.session.completed", {
      id: "cs_1", object: "checkout.session", mode: "subscription", client_reference_id: user.id,
      customer: "cus_a", subscription: "sub_a", metadata: { user_id: user.id, plan_id: "premium_monthly" }
    }).expect(200);
    setStripeClientForTests(null);
    const row = await userRow(user.id);
    assert.equal(row.plan, "premium");
    assert.equal(row.stripe_customer_id, "cus_a");
    assert.ok(new Date(row.plan_expires_at) > new Date());

    const me = await api().get("/api/billing/me").set(auth).expect(200);
    assert.equal(me.body.isPremium, true);
    assert.equal(me.body.subscription.status, "trialing");
    assert.equal(me.body.subscription.plan_id, "premium_monthly");

    const { rows } = await pool.query("SELECT type FROM activity_events WHERE user_id = $1", [user.id]);
    assert.ok(rows.some((r) => r.type === "subscription.started"));
  });

  test("subscription.updated → premium, subscription.deleted → free; invoices recorded", async () => {
    const { user } = await signup();
    await pool.query("UPDATE users SET stripe_customer_id = 'cus_b' WHERE id = $1", [user.id]);
    await sendEvent("customer.subscription.updated", subscription({ id: "sub_b", customer: "cus_b", status: "active" })).expect(200);
    assert.equal((await userRow(user.id)).plan, "premium");

    await sendEvent("invoice.paid", { id: "in_b1", object: "invoice", customer: "cus_b", amount_paid: 1299, currency: "usd" }).expect(200);
    await sendEvent("invoice.payment_failed", { id: "in_b2", object: "invoice", customer: "cus_b", amount_due: 1299, currency: "usd" }).expect(200);
    const pays = await pool.query("SELECT provider_payment_id, status, amount_cents FROM payments WHERE user_id = $1 ORDER BY id", [user.id]);
    assert.deepEqual(pays.rows.map((p) => [p.provider_payment_id, p.status]), [["in_b1", "succeeded"], ["in_b2", "failed"]]);

    await sendEvent("customer.subscription.deleted", subscription({ id: "sub_b", customer: "cus_b", status: "canceled" })).expect(200);
    const row = await userRow(user.id);
    assert.equal(row.plan, "free");
    assert.equal(row.plan_expires_at, null);

    const { rows } = await pool.query("SELECT type FROM activity_events WHERE user_id = $1 ORDER BY id", [user.id]);
    const types = rows.map((r) => r.type);
    for (const t of ["subscription.started", "payment.succeeded", "payment.failed", "subscription.canceled"]) assert.ok(types.includes(t), t);
  });

  test("a duplicate event id is ignored", async () => {
    const { user } = await signup();
    await pool.query("UPDATE users SET stripe_customer_id = 'cus_c' WHERE id = $1", [user.id]);
    const sub = subscription({ id: "sub_c", customer: "cus_c", status: "active" });
    await sendEvent("customer.subscription.created", sub, { id: "evt_dup" }).expect(200);
    await pool.query("UPDATE users SET plan = 'free' WHERE id = $1", [user.id]);
    const again = await sendEvent("customer.subscription.created", sub, { id: "evt_dup" }).expect(200);
    assert.equal(again.body.duplicate, true);
    assert.equal((await userRow(user.id)).plan, "free");
  });

  test("unhandled event types return 200", async () => {
    const r = await sendEvent("customer.created", { id: "cus_x", object: "customer" }).expect(200);
    assert.equal(r.body.handled, false);
  });

  test("admin overview reports MRR, subscribers and revenue", async () => {
    const { auth } = await adminSession();
    const r = await api().get("/api/admin/billing/overview").set(auth).expect(200);
    assert.equal(r.body.revenue.length, 30);
    assert.ok(r.body.totals.revenue_30d_cents >= 1299);
    assert.ok(r.body.totals.mrr_cents >= 1299); // the trialing monthly subscription
    assert.ok(r.body.totals.trialing >= 1);
    assert.ok(r.body.totals.canceled_30d >= 1);
    assert.ok(r.body.payments.some((p) => p.email));
    assert.ok(r.body.subscribers.length >= 1);
  });
});
