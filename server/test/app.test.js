import assert from "node:assert/strict";
import { after, before, describe, test } from "node:test";
import { adminSession, api, pool, resetDb, signup } from "./helpers.js";
import { decrypt, encrypt } from "../src/lib/crypto.js";
import { normalizePlan } from "../src/services/plan.js";

before(resetDb);
after(() => pool.end());

describe("auth", () => {
  test("register, login, me", async () => {
    const { auth } = await signup("hamza@example.com");
    const me = await api().get("/api/auth/me").set(auth).expect(200);
    assert.equal(me.body.user.email, "hamza@example.com");
    assert.equal(me.body.user.plan, "free");
    assert.equal(me.body.profile.onboarded, false);

    await api().post("/api/auth/login").send({ email: "HAMZA@example.com", password: "password123" }).expect(200);
    const bad = await api().post("/api/auth/login").send({ email: "hamza@example.com", password: "wrong-pass" }).expect(400);
    assert.equal(bad.body.error.code, "invalid_credentials");
  });

  test("duplicate email and weak password are rejected", async () => {
    await signup("dup@example.com");
    const dup = await api().post("/api/auth/register").send({ email: "dup@example.com", password: "password123" });
    assert.equal(dup.status, 409);
    const weak = await api().post("/api/auth/register").send({ email: "weak@example.com", password: "short" });
    assert.equal(weak.status, 400);
    assert.ok(weak.body.error.fields.password);
  });

  test("requests without a token are rejected", async () => {
    await api().get("/api/today").expect(401);
    await api().get("/api/today").set({ Authorization: "Bearer nope" }).expect(401);
  });

  test("account deletion needs the password and removes data", async () => {
    const { auth } = await signup();
    await api().delete("/api/auth/me").set(auth).send({ password: "wrong" }).expect(400);
    await api().delete("/api/auth/me").set(auth).send({ password: "password123" }).expect(204);
    await api().get("/api/auth/me").set(auth).expect(401);
  });
});

describe("profile / onboarding", () => {
  test("gender sets the theme, explicit theme wins, onboarding completes", async () => {
    const { auth } = await signup();
    let r = await api().patch("/api/profile").set(auth).send({ name: "Sara", gender: "female" }).expect(200);
    assert.equal(r.body.profile.theme, "female");
    r = await api()
      .patch("/api/profile")
      .set(auth)
      .send({ gender: "male", theme: "neutral", height_cm: 178, weight_kg: 82, complete_onboarding: true })
      .expect(200);
    assert.equal(r.body.profile.theme, "neutral");
    assert.equal(r.body.profile.height_cm, 178);
    assert.equal(r.body.profile.onboarded, true);
  });

  test("unknown fields and bad values are rejected", async () => {
    const { auth } = await signup();
    await api().patch("/api/profile").set(auth).send({ role: "admin" }).expect(400);
    await api().patch("/api/profile").set(auth).send({ height_cm: 9000 }).expect(400);
  });
});

describe("goals, tasks and today", () => {
  test("creating a goal builds a plan and fills Today", async () => {
    const { auth } = await signup();
    const r = await api().post("/api/goals").set(auth).send({ title: "Lose 7 kg", target: "75 kg" }).expect(201);
    assert.equal(r.body.goal.plan_source, "template");
    assert.equal(r.body.goal.category, "fitness");
    assert.ok(r.body.milestones.length >= 3);
    assert.equal(r.body.milestones[0].status, "in_progress");
    assert.ok(r.body.tasks.length >= 3);

    const today = await api().get("/api/today").set(auth).expect(200);
    assert.ok(today.body.tasks.length >= 1);
    assert.equal(today.body.done, 0);

    const task = today.body.tasks[0];
    await api().patch(`/api/tasks/${task.id}`).set(auth).send({ done: true }).expect(200);
    const after = await api().get("/api/today").set(auth).expect(200);
    assert.equal(after.body.done, 1);
    assert.ok(after.body.lifeScore.score > 0);
  });

  test("free plan allows one active goal; pausing frees the slot", async () => {
    const { auth } = await signup();
    const first = await api().post("/api/goals").set(auth).send({ title: "Read 20 books" }).expect(201);
    const blocked = await api().post("/api/goals").set(auth).send({ title: "Save $20,000" });
    assert.equal(blocked.status, 402);
    assert.equal(blocked.body.error.code, "goal_limit");
    await api().patch(`/api/goals/${first.body.goal.id}`).set(auth).send({ status: "paused" }).expect(200);
    await api().post("/api/goals").set(auth).send({ title: "Save $20,000" }).expect(201);
    // Re-activating the paused goal is blocked while another is active.
    await api().patch(`/api/goals/${first.body.goal.id}`).set(auth).send({ status: "active" }).expect(402);
  });

  test("completing milestones moves goal progress", async () => {
    const { auth } = await signup();
    const g = await api().post("/api/goals").set(auth).send({ title: "Learn Spanish" }).expect(201);
    const m = g.body.milestones[0];
    const r = await api().patch(`/api/goals/${g.body.goal.id}/milestones/${m.id}`).set(auth).send({ status: "done" }).expect(200);
    assert.equal(r.body.goal.progress, Math.round(100 / g.body.milestones.length));
  });

  test("users cannot see each other's goals or tasks", async () => {
    const a = await signup();
    const b = await signup();
    const g = await api().post("/api/goals").set(a.auth).send({ title: "Start a business" }).expect(201);
    await api().get(`/api/goals/${g.body.goal.id}`).set(b.auth).expect(404);
    await api().patch(`/api/tasks/${g.body.tasks[0].id}`).set(b.auth).send({ done: true }).expect(404);
    await api().get("/api/goals/not-a-uuid").set(b.auth).expect(404);
  });

  test("custom tasks can be added and deleted", async () => {
    const { auth } = await signup();
    const t = await api().post("/api/tasks").set(auth).send({ title: "Spend less than $40", source: "money" }).expect(201);
    assert.equal(t.body.task.source, "money");
    await api().delete(`/api/tasks/${t.body.task.id}`).set(auth).expect(204);
  });
});

describe("journal", () => {
  test("entries are encrypted at rest, searchable and deletable", async () => {
    const { auth } = await signup();
    const e = await api().post("/api/journal").set(auth).send({ body: "Felt proud of the landing page", mood: "happy" }).expect(201);
    await api().post("/api/journal").set(auth).send({ body: "Tired today" }).expect(201);
    const raw = await pool.query("SELECT body_enc FROM journal_entries WHERE id = $1", [e.body.entry.id]);
    assert.ok(!raw.rows[0].body_enc.includes("proud"));
    const found = await api().get("/api/journal?q=landing").set(auth).expect(200);
    assert.equal(found.body.entries.length, 1);
    await api().delete(`/api/journal/${e.body.entry.id}`).set(auth).expect(204);
  });
});

describe("admin", () => {
  test("regular users are blocked from admin routes", async () => {
    const { auth } = await signup();
    await api().get("/api/admin/stats").set(auth).expect(403);
  });

  test("stats, user list, upgrade and suspend with audit trail", async () => {
    const admin = await adminSession();
    const target = await signup("target@example.com");

    const stats = await api().get("/api/admin/stats").set(admin.auth).expect(200);
    assert.ok(stats.body.totals.users >= 2);
    assert.equal(stats.body.signups.length, 30);
    assert.equal(stats.body.system.aiEnabled, false);

    const list = await api().get("/api/admin/users?q=target@").set(admin.auth).expect(200);
    assert.equal(list.body.total, 1);

    await api().patch(`/api/admin/users/${target.user.id}`).set(admin.auth).send({ plan: "premium" }).expect(200);
    // Premium lifts the one-goal limit.
    await api().post("/api/goals").set(target.auth).send({ title: "Goal one" }).expect(201);
    await api().post("/api/goals").set(target.auth).send({ title: "Goal two" }).expect(201);

    await api().patch(`/api/admin/users/${target.user.id}`).set(admin.auth).send({ status: "suspended" }).expect(200);
    const blocked = await api().get("/api/today").set(target.auth);
    assert.equal(blocked.status, 403);

    const detail = await api().get(`/api/admin/users/${target.user.id}`).set(admin.auth).expect(200);
    assert.equal(detail.body.goals.length, 2);
    assert.equal(detail.body.log.length, 2);
    assert.equal(detail.body.user.weight_kg, undefined);

    const auditLog = await api().get("/api/admin/audit").set(admin.auth).expect(200);
    assert.ok(auditLog.body.entries.some((e) => e.action === "user.updated" && e.actor_email === "admin@example.com"));
  });

  test("admins cannot suspend themselves", async () => {
    const admin = await adminSession();
    await api().patch(`/api/admin/users/${admin.user.id}`).set(admin.auth).send({ status: "suspended" }).expect(400);
  });

  test("ai usage report has 30 days", async () => {
    const admin = await adminSession();
    const r = await api().get("/api/admin/ai-usage").set(admin.auth).expect(200);
    assert.equal(r.body.daily.length, 30);
  });
});

describe("units", () => {
  test("encrypt/decrypt round trip", () => {
    const blob = encrypt("hello ✨");
    assert.notEqual(blob, "hello ✨");
    assert.equal(decrypt(blob), "hello ✨");
  });

  test("normalizePlan clamps counts, days and the deadline", () => {
    const plan = normalizePlan(
      {
        summary: "x",
        category: "money",
        milestones: Array.from({ length: 9 }, (_, i) => ({ title: `M${i}`, weeks_from_start: 50 - i })),
        first_week_tasks: [{ title: "a", day: -3 }, { title: "b", day: 40 }, { title: "  ", day: 1 }]
      },
      { title: "Save", deadline: "2026-12-31" },
      "2026-11-01"
    );
    assert.equal(plan.milestones.length, 6);
    assert.ok(plan.milestones.every((m) => m.due_date <= "2026-12-31"));
    assert.deepEqual(plan.tasks.map((t) => t.due_date), ["2026-11-01", "2026-11-07"]);
  });
});

describe("admin bootstrap", () => {
  test("password is only replaced when reset is on", async () => {
    const { ensureAdmin } = await import("../src/services/bootstrap.js");
    await ensureAdmin("boot@example.com", "first-password-123", false);
    await ensureAdmin("boot@example.com", "second-password-456", false);
    await api().post("/api/auth/login").send({ email: "boot@example.com", password: "first-password-123" }).expect(200);
    await ensureAdmin("boot@example.com", "second-password-456", true);
    await api().post("/api/auth/login").send({ email: "boot@example.com", password: "second-password-456" }).expect(200);
    assert.equal(await ensureAdmin("short@example.com", "too-short", false), null);
  });
});
