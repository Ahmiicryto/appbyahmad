import assert from "node:assert/strict";
import { after, afterEach, before, describe, test } from "node:test";
import { adminSession, api, pool, resetDb, signup } from "./helpers.js";
import { resetRevenueCatFetch, setRevenueCatFetch } from "../src/services/revenuecat.js";
import { setSetting } from "../src/services/settings.js";

const AUTH = "rc-webhook-password-1234567890";
const HOUR = 3600_000;

before(resetDb);
after(() => pool.end());

let n = 0;
const event = (user, type, extra = {}) => ({
  api_version: "1.0",
  event: {
    id: `evt_${++n}`,
    type,
    app_user_id: user.user.id,
    aliases: ["$RCAnonymousID:abc", user.user.id],
    product_id: "premium_monthly",
    period_type: "NORMAL",
    store: "app_store",
    environment: "SANDBOX",
    expiration_at_ms: Date.now() + 30 * 24 * HOUR,
    event_timestamp_ms: Date.now(),
    price: 12.99,
    currency: "USD",
    ...extra
  }
});
const send = (body, auth = AUTH) => api().post("/api/billing/revenuecat/webhook").set("Authorization", auth).send(body);
const plan = async (id) => (await pool.query("SELECT plan, plan_expires_at FROM users WHERE id = $1", [id])).rows[0];

describe("RevenueCat webhook", () => {
  before(async () => {
    await setSetting("revenuecat_webhook_auth", AUTH);
  });

  test("rejects a missing or wrong password, and explains when not configured", async () => {
    const u = await signup();
    await send(event(u, "INITIAL_PURCHASE"), "wrong").expect(401);
    await setSetting("revenuecat_webhook_auth", null);
    const r = await send(event(u, "INITIAL_PURCHASE")).expect(400);
    assert.equal(r.body.error.code, "webhook_not_configured");
    await setSetting("revenuecat_webhook_auth", AUTH);
    assert.equal((await plan(u.user.id)).plan, "free");
  });

  test("purchase grants Premium, records the payment, and duplicates are ignored", async () => {
    const u = await signup();
    const body = event(u, "INITIAL_PURCHASE");
    const r = await send(body).expect(200);
    assert.equal(r.body.handled, true);
    const p = await plan(u.user.id);
    assert.equal(p.plan, "premium");
    assert.ok(new Date(p.plan_expires_at) > new Date());

    const sub = (await pool.query("SELECT * FROM subscriptions WHERE user_id = $1", [u.user.id])).rows[0];
    assert.equal(sub.provider, "apple");
    assert.equal(sub.plan_id, "premium_monthly");
    assert.equal(sub.status, "active");

    const pay = (await pool.query("SELECT * FROM payments WHERE user_id = $1", [u.user.id])).rows;
    assert.equal(pay.length, 1);
    assert.equal(pay[0].amount_cents, 1299);
    assert.equal(pay[0].provider, "apple");

    const again = await send(body).expect(200);
    assert.equal(again.body.duplicate, true);
    assert.equal((await pool.query("SELECT count(*)::int AS c FROM payments WHERE user_id = $1", [u.user.id])).rows[0].c, 1);
  });

  test("trial, cancellation keeps access until expiry, expiration removes it", async () => {
    const u = await signup();
    await send(event(u, "INITIAL_PURCHASE", { period_type: "TRIAL", price: 0, store: "play_store", product_id: "premium_yearly:yearly" })).expect(200);
    let sub = (await pool.query("SELECT * FROM subscriptions WHERE user_id = $1", [u.user.id])).rows[0];
    assert.equal(sub.status, "trialing");
    assert.equal(sub.provider, "google");
    assert.equal(sub.plan_id, "premium_yearly", "Google base-plan suffix is stripped");
    assert.equal((await pool.query("SELECT count(*)::int AS c FROM payments WHERE user_id = $1", [u.user.id])).rows[0].c, 0, "free trial is not a payment");

    await send(event(u, "CANCELLATION", { period_type: "TRIAL", store: "play_store", product_id: "premium_yearly:yearly", cancel_reason: "UNSUBSCRIBE" })).expect(200);
    sub = (await pool.query("SELECT * FROM subscriptions WHERE user_id = $1", [u.user.id])).rows[0];
    assert.equal(sub.cancel_at_period_end, true);
    assert.equal((await plan(u.user.id)).plan, "premium");

    await send(event(u, "EXPIRATION", { store: "play_store", product_id: "premium_yearly:yearly", expiration_at_ms: Date.now() - 1000 })).expect(200);
    assert.equal((await plan(u.user.id)).plan, "free");
  });

  test("an older event arriving late doesn't undo a newer one", async () => {
    const u = await signup();
    await send(event(u, "EXPIRATION", { event_timestamp_ms: Date.now(), expiration_at_ms: Date.now() - 1000 })).expect(200);
    await send(event(u, "RENEWAL", { event_timestamp_ms: Date.now() - 10 * HOUR })).expect(200);
    assert.equal((await plan(u.user.id)).plan, "free");
  });

  test("unknown users and TEST events are acknowledged but change nothing", async () => {
    const r1 = await send({ event: { id: "evt_test", type: "TEST", app_user_id: "x" } }).expect(200);
    assert.equal(r1.body.handled, false);
    const r2 = await send({ event: { id: "evt_unknown", type: "INITIAL_PURCHASE", app_user_id: "$RCAnonymousID:zzz", product_id: "premium_monthly" } }).expect(200);
    assert.equal(r2.body.handled, false);
  });

  test("works during maintenance mode", async () => {
    const u = await signup();
    await setSetting("maintenance_mode", true);
    try {
      await send(event(u, "INITIAL_PURCHASE")).expect(200);
    } finally {
      await setSetting("maintenance_mode", false);
    }
    assert.equal((await plan(u.user.id)).plan, "premium");
  });
});

describe("RevenueCat sync", () => {
  afterEach(async () => {
    resetRevenueCatFetch();
    await setSetting("revenuecat_secret_key", null);
  });

  const subscriber = (s) => async (url, opts) => {
    assert.match(String(url), /^https:\/\/api\.revenuecat\.com\/v1\/subscribers\//);
    assert.equal(opts.headers.Authorization, "Bearer sk_testsecret123");
    return new Response(JSON.stringify({ subscriber: s }), { status: 200, headers: { "Content-Type": "application/json" } });
  };

  test("explains when the secret key is missing", async () => {
    const u = await signup();
    const r = await api().post("/api/billing/revenuecat/sync").set(u.auth).expect(400);
    assert.equal(r.body.error.code, "store_not_configured");
  });

  test("active entitlement makes the user Premium; expired makes them Free", async () => {
    const u = await signup();
    await setSetting("revenuecat_secret_key", "sk_testsecret123");
    const future = new Date(Date.now() + 7 * 24 * HOUR).toISOString();
    setRevenueCatFetch(subscriber({
      entitlements: { premium: { expires_date: future, product_identifier: "premium_yearly" } },
      subscriptions: { premium_yearly: { store: "app_store", expires_date: future, period_type: "trial", unsubscribe_detected_at: null } }
    }));
    let r = await api().post("/api/billing/revenuecat/sync").set(u.auth).expect(200);
    assert.equal(r.body.isPremium, true);
    const me = await api().get("/api/billing/me").set(u.auth).expect(200);
    assert.equal(me.body.subscription.provider, "apple");
    assert.equal(me.body.subscription.status, "trialing");

    const past = new Date(Date.now() - HOUR).toISOString();
    setRevenueCatFetch(subscriber({
      entitlements: { premium: { expires_date: past, product_identifier: "premium_yearly" } },
      subscriptions: { premium_yearly: { store: "app_store", expires_date: past, period_type: "normal" } }
    }));
    r = await api().post("/api/billing/revenuecat/sync").set(u.auth).expect(200);
    assert.equal(r.body.isPremium, false);
  });

  test("a rejected secret key gives a clear error", async () => {
    const u = await signup();
    await setSetting("revenuecat_secret_key", "sk_testsecret123");
    setRevenueCatFetch(async () => new Response("{}", { status: 401 }));
    const r = await api().post("/api/billing/revenuecat/sync").set(u.auth).expect(502);
    assert.equal(r.body.error.code, "store_auth");
  });

  test("webhook with a secret key syncs from the REST API", async () => {
    const u = await signup();
    await setSetting("revenuecat_secret_key", "sk_testsecret123");
    await setSetting("revenuecat_webhook_auth", AUTH);
    const future = new Date(Date.now() + 30 * 24 * HOUR).toISOString();
    setRevenueCatFetch(subscriber({
      entitlements: { premium: { expires_date: future, product_identifier: "premium_monthly" } },
      subscriptions: { premium_monthly: { store: "play_store", expires_date: future, period_type: "normal" } }
    }));
    await send(event(u, "RENEWAL")).expect(200);
    assert.equal((await plan(u.user.id)).plan, "premium");
    assert.equal((await pool.query("SELECT count(*)::int AS c FROM payments WHERE user_id = $1", [u.user.id])).rows[0].c, 1);
  });
});

describe("store config", () => {
  test("app config and plans expose public keys only", async () => {
    const admin = await adminSession();
    await api().patch("/api/admin/settings").set(admin.auth)
      .send({ revenuecat_ios_key: "appl_abc123", revenuecat_android_key: "goog_def456", revenuecat_secret_key: "sk_supersecret999" })
      .expect(200);
    const cfg = await api().get("/api/app-config").expect(200);
    assert.deepEqual(cfg.body.purchases, { enabled: true, iosKey: "appl_abc123", androidKey: "goog_def456", entitlement: "premium" });
    assert.ok(!JSON.stringify(cfg.body).includes("sk_supersecret999"));

    const bad = await api().patch("/api/admin/settings").set(admin.auth).send({ revenuecat_ios_key: "nope" }).expect(400);
    assert.ok(bad.body.error.fields.revenuecat_ios_key);

    const s = await api().get("/api/admin/settings").set(admin.auth).expect(200);
    assert.equal(s.body.groups.store.revenuecat_secret_key.configured, true);
    assert.ok(!JSON.stringify(s.body).includes("sk_supersecret999"));

    const u = await signup();
    const plans = await api().get("/api/billing/plans").set(u.auth).expect(200);
    assert.equal(plans.body.storePurchases.enabled, true);
    assert.ok(plans.body.plans.every((p) => "store_product_id" in p));
  });

  test("admin can set a plan's store product id; duplicates are refused", async () => {
    const admin = await adminSession();
    const r = await api().patch("/api/admin/billing/plans/premium_monthly").set(admin.auth).send({ store_product_id: "com.appbyahmad.monthly" }).expect(200);
    assert.equal(r.body.plan.store_product_id, "com.appbyahmad.monthly");
    const dup = await api().patch("/api/admin/billing/plans/premium_yearly").set(admin.auth).send({ store_product_id: "com.appbyahmad.monthly" }).expect(409);
    assert.equal(dup.body.error.code, "store_product_taken");
    await api().patch("/api/admin/billing/plans/premium_monthly").set(admin.auth).send({ store_product_id: "premium_monthly" }).expect(200);
  });
});

describe("profile", () => {
  test("avatar, phone, country and appearance save; bad values are refused", async () => {
    const u = await signup();
    const photo = "data:image/jpeg;base64," + "A".repeat(2000);
    let r = await api().patch("/api/profile").set(u.auth).send({ avatar: photo, phone: "+92 300 1234567", country: "Pakistan", appearance: "light" }).expect(200);
    assert.equal(r.body.profile.avatar, photo);
    assert.equal(r.body.profile.appearance, "light");
    r = await api().patch("/api/profile").set(u.auth).send({ avatar: "🦁" }).expect(200);
    assert.equal(r.body.profile.avatar, "🦁");
    await api().patch("/api/profile").set(u.auth).send({ avatar: "data:text/html;base64,PHNjcmlwdD4=" }).expect(400);
    await api().patch("/api/profile").set(u.auth).send({ avatar: "<script>" }).expect(400);
    await api().patch("/api/profile").set(u.auth).send({ phone: "call me" }).expect(400);
    await api().patch("/api/profile").set(u.auth).send({ appearance: "neon" }).expect(400);
  });

  test("stats count a streak of completed days", async () => {
    const u = await signup();
    for (const d of [0, 1, 2, 4]) {
      await pool.query(
        "INSERT INTO tasks (user_id, title, due_date, done_at) VALUES ($1, 't', (now() AT TIME ZONE 'UTC')::date - $2::int, now())",
        [u.user.id, d]
      );
    }
    const r = await api().get("/api/profile/stats").set(u.auth).expect(200);
    assert.equal(r.body.streak, 3);
    assert.equal(r.body.tasks_done, 4);
    assert.equal(r.body.goals, 0);
    assert.ok(r.body.member_since);
  });
});
