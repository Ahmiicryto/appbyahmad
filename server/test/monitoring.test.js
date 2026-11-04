import assert from "node:assert/strict";
import { after, before, describe, test } from "node:test";
import { adminSession, api, pool, resetDb, signup } from "./helpers.js";
import { errorHandler } from "../src/lib/errors.js";

before(resetDb);
after(() => pool.end());

// track() and logError() are fire-and-forget, so wait for the row to land.
async function waitFor(fn, { timeout = 3000 } = {}) {
  const start = Date.now();
  for (;;) {
    const v = await fn();
    if (v) return v;
    if (Date.now() - start > timeout) return v;
    await new Promise((r) => setTimeout(r, 25));
  }
}

const eventsFor = async (userId) =>
  (await pool.query("SELECT type, meta FROM activity_events WHERE user_id = $1 ORDER BY id", [userId])).rows;

const GOAL_TITLE = "Run a marathon in Lisbon zq7";
const JOURNAL_BODY = "Dear diary, a very private thought zq8";
const TASK_TITLE = "Buy running shoes zq9";

let alice;
let bob;
let admin;

describe("activity tracking", () => {
  test("key actions are recorded without any content", async () => {
    alice = await signup("alice@example.com");
    await api().post("/api/auth/login").send({ email: "alice@example.com", password: "password123" }).expect(200);
    await api().patch("/api/profile").set(alice.auth).send({ gender: "female", complete_onboarding: true }).expect(200);
    // Completing onboarding again is not a new event.
    await api().patch("/api/profile").set(alice.auth).send({ complete_onboarding: true }).expect(200);
    const g = await api().post("/api/goals").set(alice.auth).send({ title: GOAL_TITLE, category: "fitness" }).expect(201);
    const t = await api().post("/api/tasks").set(alice.auth).send({ title: TASK_TITLE, source: "fitness" }).expect(201);
    await api().patch(`/api/tasks/${t.body.task.id}`).set(alice.auth).send({ done: true }).expect(200);
    await api().post("/api/journal").set(alice.auth).send({ body: JOURNAL_BODY, mood: "good" }).expect(201);
    await api().patch(`/api/goals/${g.body.goal.id}`).set(alice.auth).send({ status: "paused" }).expect(200);

    const events = await waitFor(async () => {
      const rows = await eventsFor(alice.user.id);
      return rows.length >= 9 ? rows : null;
    });
    assert.ok(events, "expected activity rows");
    const types = events.map((e) => e.type);
    for (const t of [
      "auth.registered",
      "auth.signed_in",
      "onboarding.completed",
      "profile.theme_changed",
      "goal.created",
      "task.created",
      "task.completed",
      "journal.entry_created",
      "goal.status_changed"
    ]) {
      assert.ok(types.includes(t), `missing ${t}`);
    }
    assert.equal(types.filter((t) => t === "onboarding.completed").length, 1);

    const byType = Object.fromEntries(events.map((e) => [e.type, e.meta]));
    assert.deepEqual(byType["goal.created"], { category: "fitness", plan_source: "template" });
    assert.deepEqual(byType["task.completed"], { source: "fitness" });
    // The journal is private: not even the mood is visible to admins.
    assert.deepEqual(byType["journal.entry_created"], {});
    assert.deepEqual(byType["goal.status_changed"], { status: "paused" });
    assert.deepEqual(byType["profile.theme_changed"], { theme: "female" });

    const all = JSON.stringify(events);
    for (const secret of [GOAL_TITLE, JOURNAL_BODY, TASK_TITLE, "zq7", "zq8", "zq9"]) {
      assert.ok(!all.includes(secret), `activity meta leaked content: ${secret}`);
    }
  });

  test("summary: daily active users, totals and funnel", async () => {
    bob = await signup("bob@example.com");
    await api().patch("/api/profile").set(bob.auth).send({ complete_onboarding: true }).expect(200);
    admin = await adminSession();
    await waitFor(async () => (await eventsFor(bob.user.id)).length >= 2);
    await waitFor(async () => (await eventsFor(admin.user.id)).length >= 1);
    // One older event, so a past day has activity too.
    await pool.query("INSERT INTO activity_events (user_id, type, created_at) VALUES ($1, 'auth.signed_in', now() - interval '3 days')", [
      bob.user.id
    ]);

    const r = await api().get("/api/admin/activity/summary?days=30").set(admin.auth).expect(200);
    assert.equal(r.body.dau.length, 30);
    assert.equal(r.body.dau.at(-1).count, 3); // alice, bob, admin
    assert.equal(r.body.dau.at(-4).count, 1); // bob, 3 days ago
    assert.equal(r.body.dau.at(-2).count, 0);
    assert.equal(r.body.totals.active_today, 3);
    assert.equal(r.body.totals.active_7d, 3);
    assert.equal(r.body.totals.active_30d, 3);

    const funnel = Object.fromEntries(r.body.funnel.map((s) => [s.step, s]));
    assert.equal(funnel["auth.registered"].count, 2);
    assert.equal(funnel["onboarding.completed"].count, 2);
    assert.equal(funnel["goal.created"].count, 1);
    assert.equal(funnel["task.completed"].count, 1);
    assert.equal(funnel["task.completed"].pct, 50);

    const signedIn = r.body.byType.find((t) => t.type === "auth.signed_in");
    assert.equal(signedIn.count, 3); // alice login, admin login, bob's backdated event
    assert.equal(r.body.topUsers[0].email, "alice@example.com");
  });

  test("feed filters by type and user; user timeline", async () => {
    let r = await api().get("/api/admin/activity?type=goal.created").set(admin.auth).expect(200);
    assert.equal(r.body.events.length, 1);
    assert.equal(r.body.events[0].email, "alice@example.com");
    assert.ok(r.body.types.includes("task.completed"));

    r = await api().get("/api/admin/activity?user=bob@").set(admin.auth).expect(200);
    assert.ok(r.body.events.length >= 2);
    assert.ok(r.body.events.every((e) => e.email === "bob@example.com"));
    r = await api().get(`/api/admin/activity?user=${bob.user.id}&days=1`).set(admin.auth).expect(200);
    assert.ok(r.body.events.every((e) => e.user_id === bob.user.id));
    assert.ok(!r.body.events.some((e) => new Date(e.created_at) < Date.now() - 86400000));

    r = await api().get(`/api/admin/activity/user/${alice.user.id}`).set(admin.auth).expect(200);
    assert.ok(r.body.events.length >= 9);
    assert.ok(new Date(r.body.events[0].created_at) >= new Date(r.body.events.at(-1).created_at));
    await api().get("/api/admin/activity?days=500").set(admin.auth).expect(400);
  });
});

describe("error logs", () => {
  const latest = async () => (await pool.query("SELECT * FROM error_logs ORDER BY id DESC LIMIT 1")).rows[0];

  test("client error reports are stored, with or without a token", async () => {
    await api()
      .post("/api/client-errors")
      .send({ message: "TypeError: undefined is not a function", stack: "TypeError\n    at Today (Today.js:10:3)", path: "/today", platform: "ios", app_version: "1.2.0" })
      .expect(204);
    let row = await latest();
    assert.equal(row.source, "app");
    assert.equal(row.user_id, null);
    assert.equal(row.path, "/today");
    assert.deepEqual(row.meta, { platform: "ios", app_version: "1.2.0" });

    await api().post("/api/client-errors").set(alice.auth).send({ message: "Network request failed", level: "warn" }).expect(204);
    row = await latest();
    assert.equal(row.user_id, alice.user.id);
    assert.equal(row.level, "warn");

    // A bad token never blocks the report.
    await api().post("/api/client-errors").set({ Authorization: "Bearer nope" }).send({ message: "Anon crash" }).expect(204);
    assert.equal((await latest()).user_id, null);

    // Only a signed-in admin can label a report as coming from the admin dashboard.
    await api().post("/api/client-errors").send({ message: "Admin page crashed", source: "admin" }).expect(204);
    assert.equal((await latest()).source, "app");
    const admin = await adminSession();
    await api().post("/api/client-errors").set(admin.auth).send({ message: "Admin page crashed for real", source: "admin" }).expect(204);
    assert.equal((await latest()).source, "admin");

    await api().post("/api/client-errors").send({}).expect(400);
    await api().post("/api/client-errors").send({ message: "x", level: "debug" }).expect(400);

    // Anonymous reports are kept small; signed-in reports keep more detail.
    await api().post("/api/client-errors").send({ message: "y".repeat(5000), stack: "s".repeat(20000) }).expect(204);
    row = await latest();
    assert.equal(row.message.length, 500);
    assert.equal(row.stack.length, 2000);
    await api().post("/api/client-errors").set(alice.auth).send({ message: "z".repeat(5000), stack: "s".repeat(20000) }).expect(204);
    row = await latest();
    assert.equal(row.message.length, 2000);
    assert.equal(row.stack.length, 8000);
  });

  test("repeats of one error are capped per hour", async () => {
    const { MAX_PER_FINGERPRINT_PER_HOUR } = await import("../src/services/errorLog.js");
    for (let i = 0; i < MAX_PER_FINGERPRINT_PER_HOUR + 5; i++) {
      await api().post("/api/client-errors").send({ message: "Flood crash", stack: "at flood (x.js:1:1)" }).expect(204);
    }
    const { rows } = await pool.query("SELECT count(*)::int AS n FROM error_logs WHERE message = 'Flood crash'");
    assert.equal(rows[0].n, MAX_PER_FINGERPRINT_PER_HOUR);
  });

  test("old error logs and activity are pruned", async () => {
    const { pruneOldData } = await import("../src/services/retention.js");
    await pool.query("INSERT INTO error_logs (source, message, fingerprint, created_at) VALUES ('app', 'ancient', 'f_old', now() - interval '40 days'), ('app', 'recent', 'f_new', now())");
    await pool.query("INSERT INTO activity_events (type, created_at) VALUES ('ancient.event', now() - interval '400 days'), ('recent.event', now())");
    const removed = await pruneOldData();
    assert.ok(removed.errors >= 1 && removed.activity >= 1);
    const left = await pool.query("SELECT message FROM error_logs WHERE message IN ('ancient', 'recent')");
    assert.deepEqual(left.rows.map((r) => r.message), ["recent"]);
    const acts = await pool.query("SELECT type FROM activity_events WHERE type IN ('ancient.event', 'recent.event')");
    assert.deepEqual(acts.rows.map((r) => r.type), ["recent.event"]);
  });

  test("unhandled server errors are logged by the error handler", async () => {
    const res = {
      statusCode: 0,
      body: null,
      status(c) {
        this.statusCode = c;
        return this;
      },
      json(b) {
        this.body = b;
        return this;
      }
    };
    const req = { method: "POST", originalUrl: "/api/boom?x=1", path: "/api/boom", user: { id: alice.user.id } };
    errorHandler(new Error("Kaboom from a route"), req, res, () => {});
    assert.equal(res.statusCode, 500);
    assert.equal(res.body.error.code, "server_error");
    const row = await waitFor(async () => (await pool.query("SELECT * FROM error_logs WHERE message = 'Kaboom from a route'")).rows[0]);
    assert.ok(row, "expected an error_logs row");
    assert.equal(row.source, "server");
    assert.equal(row.path, "POST /api/boom?x=1");
    assert.equal(row.user_id, alice.user.id);
    assert.match(row.stack, /Kaboom/);

    // Expected errors (4xx) are not logged.
    const before = (await pool.query("SELECT count(*)::int AS n FROM error_logs")).rows[0].n;
    await api().get("/api/goals/not-a-uuid").set(alice.auth).expect(404);
    await new Promise((r) => setTimeout(r, 100));
    assert.equal((await pool.query("SELECT count(*)::int AS n FROM error_logs")).rows[0].n, before);
  });

  test("errors are grouped by fingerprint and can be resolved and reopened", async () => {
    const stack = "Error: x\n    at loadGoal (goals.js:42:7)";
    await api().post("/api/client-errors").set(alice.auth).send({ message: "Could not load goal 123", stack }).expect(204);
    await api().post("/api/client-errors").set(bob.auth).send({ message: "Could not load goal 4567", stack }).expect(204);
    await api().post("/api/client-errors").send({ message: "Could not load goal 89", stack }).expect(204);

    let r = await api().get("/api/admin/errors?q=could not load").set(admin.auth).expect(200);
    assert.equal(r.body.groups.length, 1);
    const g = r.body.groups[0];
    assert.equal(g.count, 3);
    assert.equal(g.users, 2);
    assert.equal(g.source, "app");
    assert.equal(g.resolved, false);
    assert.equal(g.message, "Could not load goal 89");
    const fp = g.fingerprint;

    r = await api().get(`/api/admin/errors/${fp}`).set(admin.auth).expect(200);
    assert.equal(r.body.occurrences.length, 3);
    assert.equal(r.body.group.count, 3);
    assert.ok(r.body.occurrences.some((o) => o.email === "bob@example.com"));
    assert.match(r.body.occurrences[0].stack, /loadGoal/);

    r = await api().get("/api/admin/errors?source=server&status=all").set(admin.auth).expect(200);
    assert.ok(r.body.groups.every((x) => x.source === "server"));
    assert.ok(r.body.groups.some((x) => x.message === "Kaboom from a route"));

    const sum1 = (await api().get("/api/admin/errors/summary").set(admin.auth).expect(200)).body;
    assert.equal(sum1.perDay.length, 30);
    assert.ok(sum1.perDay.at(-1).count >= 3);

    await api().post(`/api/admin/errors/${fp}/resolve`).set(admin.auth).expect(200);
    r = await api().get("/api/admin/errors?q=could not load").set(admin.auth).expect(200);
    assert.equal(r.body.groups.length, 0);
    r = await api().get("/api/admin/errors?q=could not load&status=resolved").set(admin.auth).expect(200);
    assert.equal(r.body.groups.length, 1);
    assert.equal(r.body.groups[0].resolved, true);
    const sum2 = (await api().get("/api/admin/errors/summary").set(admin.auth).expect(200)).body;
    assert.equal(sum2.open_groups, sum1.open_groups - 1);

    await api().post(`/api/admin/errors/${fp}/reopen`).set(admin.auth).expect(200);
    r = await api().get("/api/admin/errors?q=could not load").set(admin.auth).expect(200);
    assert.equal(r.body.groups.length, 1);

    // A new occurrence after resolving brings the group back as open.
    await api().post(`/api/admin/errors/${fp}/resolve`).set(admin.auth).expect(200);
    await api().post("/api/client-errors").send({ message: "Could not load goal 1", stack }).expect(204);
    r = await api().get("/api/admin/errors?q=could not load&status=open").set(admin.auth).expect(200);
    assert.equal(r.body.groups.length, 1);
    assert.equal(r.body.groups[0].count, 4);

    const audit = await pool.query("SELECT action FROM audit_log WHERE target_id = $1 ORDER BY id", [fp]);
    assert.deepEqual(audit.rows.map((a) => a.action), ["error.resolved", "error.reopened", "error.resolved"]);

    await api().get("/api/admin/errors/0123456789abcdef").set(admin.auth).expect(404);
    await api().post("/api/admin/errors/not-a-fingerprint/resolve").set(admin.auth).expect(404);
  });

  test("monitoring endpoints are admin only", async () => {
    for (const path of ["/api/admin/activity", "/api/admin/activity/summary", "/api/admin/errors", "/api/admin/errors/summary"]) {
      await api().get(path).set(alice.auth).expect(403);
      await api().get(path).expect(401);
    }
    await api().post("/api/admin/errors/0123456789abcdef/resolve").set(alice.auth).expect(403);
  });
});
