import assert from "node:assert/strict";
import { after, afterEach, before, describe, test } from "node:test";
import Anthropic from "@anthropic-ai/sdk";
import { adminSession, api, pool, resetDb, signup } from "./helpers.js";
import { resetClientFactories, setClientFactories } from "../src/routes/adminSettings.js";
import { invalidateSettings } from "../src/services/settings.js";

const AI_KEY = "sk-ant-test-supersecret-key-9f3a";
const STRIPE_KEY = "sk_test_51SuperSecretStripeKeyXYZ1";

let admin;
before(async () => {
  await resetDb();
  invalidateSettings();
  admin = await adminSession();
});
after(() => pool.end());

const patch = (body) => api().patch("/api/admin/settings").set(admin.auth).send(body);

describe("admin settings", () => {
  test("non-admins get 403, signed-out gets 401", async () => {
    const { auth } = await signup();
    await api().get("/api/admin/settings").set(auth).expect(403);
    await api().patch("/api/admin/settings").set(auth).send({ ai_enabled: false }).expect(403);
    await api().get("/api/admin/insights").set(auth).expect(403);
    await api().post("/api/admin/settings/test-ai").set(auth).expect(403);
    await api().get("/api/admin/settings").expect(401);
  });

  test("GET groups settings and masks secrets", async () => {
    await patch({ anthropic_api_key: AI_KEY }).expect(200);
    const r = await api().get("/api/admin/settings").set(admin.auth).expect(200);
    assert.ok(!JSON.stringify(r.body).includes(AI_KEY));
    const k = r.body.groups.ai.anthropic_api_key;
    assert.equal(k.configured, true);
    assert.equal(k.source, "admin");
    assert.equal(k.hint, "••••9f3a");
    assert.equal(k.value, undefined);
    assert.ok(r.body.groups.limits.free_active_goals);
    assert.ok(r.body.groups.app.feature_flags);
    assert.ok(r.body.groups.payments.stripe_secret_key);
    assert.ok(r.body.groups.push.expo_access_token);
    await patch({ anthropic_api_key: null }).expect(200);
  });

  test("PATCH validates, saves and resets to default", async () => {
    const bad = await patch({ stripe_secret_key: "pk_live_nope", ai_model: "claude-sonnet-5-5" }).expect(400);
    assert.equal(bad.body.error.code, "validation_error");
    assert.match(bad.body.error.fields.stripe_secret_key[0], /sk_test_/);
    // Nothing is saved when any field fails.
    let r = await api().get("/api/admin/settings").set(admin.auth).expect(200);
    assert.equal(r.body.settings.ai_model.source, "default");

    const unknown = await patch({ nope: 1 }).expect(400);
    assert.ok(unknown.body.error.fields.nope);
    await patch({}).expect(400);

    r = await patch({ ai_model: "claude-sonnet-5-5" }).expect(200);
    assert.equal(r.body.settings.ai_model.value, "claude-sonnet-5-5");
    assert.equal(r.body.settings.ai_model.source, "admin");

    r = await patch({ ai_model: null }).expect(200);
    assert.equal(r.body.settings.ai_model.value, "claude-opus-5-5");
    assert.equal(r.body.settings.ai_model.source, "default");
  });

  test("audit entry lists keys but never secret values", async () => {
    await patch({ stripe_secret_key: STRIPE_KEY, free_ai_plans_per_month: 5 }).expect(200);
    const { rows } = await pool.query("SELECT actor_id, details FROM audit_log WHERE action = 'settings.updated' ORDER BY id DESC LIMIT 1");
    assert.equal(rows[0].actor_id, admin.user.id);
    assert.deepEqual(rows[0].details.keys.sort(), ["free_ai_plans_per_month", "stripe_secret_key"]);
    assert.equal(rows[0].details.changes.stripe_secret_key, "replaced");
    assert.equal(rows[0].details.changes.free_ai_plans_per_month, 5);
    const { rows: all } = await pool.query("SELECT details::text AS t FROM audit_log");
    assert.ok(all.every((x) => !x.t.includes(STRIPE_KEY) && !x.t.includes(AI_KEY)));
    await patch({ stripe_secret_key: null, free_ai_plans_per_month: null }).expect(200);
  });

  test("changing the free goal limit applies immediately", async () => {
    const { auth } = await signup();
    await api().post("/api/goals").set(auth).send({ title: "Read 12 books" }).expect(201);
    const blocked = await api().post("/api/goals").set(auth).send({ title: "Run a 10k" }).expect(402);
    assert.equal(blocked.body.error.code, "goal_limit");

    await patch({ free_active_goals: 2 }).expect(200);
    await api().post("/api/goals").set(auth).send({ title: "Run a 10k" }).expect(201);
    await api().post("/api/goals").set(auth).send({ title: "Learn Spanish" }).expect(402);
    await patch({ free_active_goals: null }).expect(200);
  });

  test("closing sign-ups blocks registration", async () => {
    await patch({ signup_open: false }).expect(200);
    const r = await api().post("/api/auth/register").send({ email: "late@example.com", password: "password123" }).expect(403);
    assert.match(r.body.error.message, /closed/i);
    const cfg = await api().get("/api/app-config").expect(200);
    assert.equal(cfg.body.signupOpen, false);
    await patch({ signup_open: null }).expect(200);
    await api().post("/api/auth/register").send({ email: "late@example.com", password: "password123" }).expect(201);
  });
});

describe("maintenance mode", () => {
  test("blocks app routes but keeps sign-in, config and admin working", async () => {
    const user = await signup("maint@example.com");
    await patch({ maintenance_mode: true, maintenance_message: "Back at 3pm." }).expect(200);
    try {
      const blocked = await api().get("/api/today").set(user.auth).expect(503);
      assert.deepEqual(blocked.body.error, { code: "maintenance", message: "Back at 3pm." });
      await api().get("/api/goals?x=1").set(user.auth).expect(503);
      await api().post("/api/auth/register").send({ email: "m2@example.com", password: "password123" }).expect(503);

      await api().post("/api/auth/login").send({ email: "maint@example.com", password: "password123" }).expect(200);
      await api().get("/api/auth/me").set(user.auth).expect(200);
      const cfg = await api().get("/api/app-config").expect(200);
      assert.deepEqual(cfg.body.maintenance, { on: true, message: "Back at 3pm." });
      await api().get("/api/admin/settings").set(admin.auth).expect(200);
      await api().get("/api/admin/stats").set(admin.auth).expect(200);
      // An admin's token passes for app routes too, so they can check the app.
      await api().get("/api/today").set(admin.auth).expect(200);
      // A forged token claiming admin is not accepted.
      await api().get("/api/today").set({ Authorization: "Bearer not.a.jwt" }).expect(503);
    } finally {
      await patch({ maintenance_mode: false, maintenance_message: null }).expect(200);
    }
    await api().get("/api/today").set(user.auth).expect(200);
  });
});

describe("app config", () => {
  test("public, uncached, announcement only when active", async () => {
    let r = await api().get("/api/app-config").expect(200);
    assert.equal(r.headers["cache-control"], "no-store");
    assert.equal(r.body.maintenance.on, false);
    assert.equal(r.body.announcement, null);
    assert.equal(r.body.features.journal, true);
    assert.equal(r.body.features.money, true);
    assert.equal(r.body.features.habits, true);
    assert.equal(r.body.minAppVersion, "1.0.0");
    assert.equal(r.body.signupOpen, true);
    assert.equal(r.body.plansAvailable, 2);

    await patch({ announcement: { active: false, text: "New: weekly review", level: "success" } }).expect(200);
    r = await api().get("/api/app-config").expect(200);
    assert.equal(r.body.announcement, null);

    await patch({
      announcement: { active: true, text: "New: weekly review", level: "success" },
      feature_flags: { journal: true, money: true, fitness: false, nutrition: false, career: false, future_me: false, decisions: false, assistant: false },
      min_app_version: "1.2.0"
    }).expect(200);
    r = await api().get("/api/app-config").expect(200);
    assert.deepEqual(r.body.announcement, { text: "New: weekly review", level: "success" });
    assert.equal(r.body.features.money, true);
    assert.equal(r.body.minAppVersion, "1.2.0");

    await patch({ announcement: { active: true, text: "x", level: "loud" } }).expect(400);
    await patch({ min_app_version: "1.2" }).expect(400);
    await patch({ announcement: null, feature_flags: null, min_app_version: null }).expect(200);
  });
});

describe("connection tests", () => {
  afterEach(async () => {
    resetClientFactories();
    await patch({ anthropic_api_key: null, stripe_secret_key: null }).expect(200);
  });

  test("test-ai without a key explains what to do", async () => {
    const r = await api().post("/api/admin/settings/test-ai").set(admin.auth).expect(200);
    assert.equal(r.body.ok, false);
    assert.match(r.body.message, /No API key/);
  });

  test("test-ai success uses the saved key and model", async () => {
    let seen;
    setClientFactories({
      anthropic: (apiKey) => ({
        messages: { create: async (args) => ((seen = { apiKey, ...args }), { content: [{ type: "text", text: "OK" }] }) }
      })
    });
    await patch({ anthropic_api_key: AI_KEY, ai_model: "claude-haiku-5-5" }).expect(200);
    const r = await api().post("/api/admin/settings/test-ai").set(admin.auth).expect(200);
    assert.deepEqual(r.body, { ok: true, model: "claude-haiku-5-5" });
    assert.equal(seen.apiKey, AI_KEY);
    assert.equal(seen.model, "claude-haiku-5-5");
    assert.equal(seen.max_tokens, 16);
    await patch({ ai_model: null }).expect(200);
  });

  test("test-ai reports an invalid key and a missing model", async () => {
    await patch({ anthropic_api_key: AI_KEY }).expect(200);
    setClientFactories({
      anthropic: () => ({
        messages: { create: async () => { throw new Anthropic.AuthenticationError(401, { error: { message: "invalid x-api-key" } }, "invalid x-api-key", new Headers()); } }
      })
    });
    let r = await api().post("/api/admin/settings/test-ai").set(admin.auth).expect(200);
    assert.equal(r.body.ok, false);
    assert.match(r.body.message, /key was rejected/);
    assert.ok(!JSON.stringify(r.body).includes(AI_KEY));

    setClientFactories({
      anthropic: () => ({
        messages: { create: async () => { throw new Anthropic.NotFoundError(404, { error: { message: "model" } }, "model", new Headers()); } }
      })
    });
    r = await api().post("/api/admin/settings/test-ai").set(admin.auth).expect(200);
    assert.equal(r.body.ok, false);
    assert.match(r.body.message, /was not found/);
  });

  test("test-stripe reports mode and auth errors", async () => {
    let r = await api().post("/api/admin/settings/test-stripe").set(admin.auth).expect(200);
    assert.equal(r.body.ok, false);
    await patch({ stripe_secret_key: STRIPE_KEY }).expect(200);
    setClientFactories({ stripe: () => ({ balance: { retrieve: async () => ({ object: "balance", livemode: false }) } }) });
    r = await api().post("/api/admin/settings/test-stripe").set(admin.auth).expect(200);
    assert.deepEqual(r.body, { ok: true, mode: "test" });

    setClientFactories({
      stripe: () => ({ balance: { retrieve: async () => { throw Object.assign(new Error("Invalid API Key"), { type: "StripeAuthenticationError", statusCode: 401 }); } } })
    });
    r = await api().post("/api/admin/settings/test-stripe").set(admin.auth).expect(200);
    assert.equal(r.body.ok, false);
    assert.match(r.body.message, /rejected/);
  });
});

describe("insights", () => {
  test("returns 30 days of series and summary numbers", async () => {
    const { user } = await signup();
    await pool.query("INSERT INTO activity_events (user_id, type) VALUES ($1, 'app.open'), ($1, 'task.done')", [user.id]);
    await pool.query("INSERT INTO payments (user_id, amount_cents, currency, status) VALUES ($1, 1299, 'usd', 'succeeded'), ($1, 500, 'usd', 'failed')", [user.id]);
    await pool.query(
      "INSERT INTO subscriptions (user_id, plan_id, status, amount_cents) VALUES ($1, 'premium_yearly', 'active', 8999), ($1, 'premium_monthly', 'canceled', 1299)",
      [user.id]
    );
    await pool.query("INSERT INTO error_logs (source, message, fingerprint) VALUES ('app', 'boom', 'fp1'), ('app', 'boom', 'fp1'), ('server', 'x', 'fp2')");

    const r = await api().get("/api/admin/insights?days=30").set(admin.auth).expect(200);
    const b = r.body;
    for (const key of ["dau", "signups", "revenue"]) assert.equal(b[key].length, 30, key);
    const today = b.dau.at(-1);
    assert.match(today.day, /^\d{4}-\d{2}-\d{2}$/);
    assert.ok(today.count >= 1);
    assert.equal(b.dauSource, "events");
    assert.equal(b.revenue.at(-1).cents, 1299);
    assert.equal(b.revenueCents, 1299);
    assert.equal(b.mrrCents, 750);
    assert.equal(b.openErrors, 2);
    assert.equal(typeof b.premiumConversion, "number");
    assert.deepEqual(Object.keys(b.retention).sort(), ["cohort", "pct", "retained"]);
    assert.equal(typeof b.notificationsSent30d, "number");
    assert.equal(typeof b.goalsCompleted30d, "number");

    await api().get("/api/admin/insights?days=2").set(admin.auth).expect(400);
  });
});

describe("review fixes", () => {
  test("a demoted admin's old token no longer passes maintenance, and the payment return page stays up", async () => {
    const admin = await adminSession();
    const other = await signup();
    await pool.query("UPDATE users SET role = 'admin' WHERE id = $1", [other.user.id]);
    const login = await api().post("/api/auth/login").send({ email: other.user.email, password: "password123" }).expect(200);
    const oldAdminAuth = { Authorization: `Bearer ${login.body.token}` };
    await pool.query("UPDATE users SET role = 'user' WHERE id = $1", [other.user.id]);

    await api().patch("/api/admin/settings").set(admin.auth).send({ maintenance_mode: true }).expect(200);
    try {
      await api().get("/api/today").set(oldAdminAuth).expect(503);
      await api().get("/api/billing/return?status=success").expect(200);
    } finally {
      await api().patch("/api/admin/settings").set(admin.auth).send({ maintenance_mode: false }).expect(200);
    }
  });

  test("an unreadable saved secret is reported instead of breaking the settings page", async () => {
    const admin = await adminSession();
    await pool.query(
      `INSERT INTO settings (key, value, secret) VALUES ('expo_access_token', '{"enc":"v1:AAAA:AAAA:AAAA"}', true)
       ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`
    );
    invalidateSettings();
    const r = await api().get("/api/admin/settings").set(admin.auth).expect(200);
    const all = { ...r.body.settings, ...Object.assign({}, ...Object.values(r.body.groups || {}).map((g) => (Array.isArray(g) ? Object.fromEntries(g.map((x) => [x.key, x])) : g))) };
    const entry = all.expo_access_token;
    assert.ok(entry, "expo_access_token listed");
    assert.equal(entry.unreadable, true);
    await api().patch("/api/admin/settings").set(admin.auth).send({ expo_access_token: null }).expect(200);
  });
});
