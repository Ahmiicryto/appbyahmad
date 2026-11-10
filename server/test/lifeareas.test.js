import assert from "node:assert/strict";
import { after, afterEach, before, describe, test } from "node:test";
import { api, pool, resetDb, signup } from "./helpers.js";
import { setAiClientForTests } from "../src/services/ai.js";

before(resetDb);
after(() => pool.end());
afterEach(() => setAiClientForTests(null));

describe("fitness", () => {
  test("built-in workout when AI is off, valid exercises and doses", async () => {
    const u = await signup();
    const r = await api().post("/api/ai/workout").set(u.auth).send({ minutes: 20, focus: "core", level: "easy" }).expect(200);
    assert.equal(r.body.source, "template");
    assert.ok(r.body.blocks.length >= 5);
    for (const b of r.body.blocks) assert.ok((b.reps == null) !== (b.seconds == null), "reps or seconds");
    await api().post("/api/ai/workout").set(u.auth).send({ focus: "yoga" }).expect(400);
  });

  test("AI workout drops unknown exercises and clamps doses", async () => {
    const u = await signup();
    setAiClientForTests({
      beta: { messages: { parse: async (req) => ({ model: req.model, stop_reason: "end_turn", usage: { input_tokens: 1, output_tokens: 1 }, content: [], parsed_output: {
        title: "Core blast", summary: "Short and sharp.",
        blocks: [
          { exercise_id: "plank", reps: null, seconds: 999, rest_seconds: 20 },
          { exercise_id: "flying_kick", reps: 10, seconds: null, rest_seconds: 10 },
          { exercise_id: "crunch", reps: 15, seconds: null, rest_seconds: 15 },
          { exercise_id: "bicycle_crunch", reps: 200, seconds: null, rest_seconds: 15 }
        ] } }) } }
    });
    const r = await api().post("/api/ai/workout").set(u.auth).send({ minutes: 10, focus: "core" }).expect(200);
    assert.equal(r.body.source, "ai");
    assert.deepEqual(r.body.blocks.map((b) => b.exercise_id), ["plank", "crunch", "bicycle_crunch"]);
    assert.equal(r.body.blocks[0].seconds, 180);
    assert.equal(r.body.blocks[2].reps, 60);
  });

  test("logging a workout updates the summary, streak and today's tasks", async () => {
    const u = await signup();
    await api().patch("/api/profile").set(u.auth).send({ weight_kg: 80 }).expect(200);
    const r = await api().post("/api/fitness/logs").set(u.auth)
      .send({ title: "Full body", duration_sec: 900, exercises: [{ exercise_id: "squat", reps: 15 }, { exercise_id: "plank", seconds: 60 }] })
      .expect(201);
    assert.ok(r.body.log.calories > 0);
    const s = await api().get("/api/fitness/summary").set(u.auth).expect(200);
    assert.equal(s.body.streak, 1);
    assert.equal(s.body.week.workouts, 1);
    assert.equal(s.body.week.minutes, 15);
    assert.equal(s.body.weekDays.length, 7);
    const today = await api().get("/api/today").set(u.auth).expect(200);
    assert.ok(today.body.tasks.some((t) => t.title === "Workout: Full body" && t.done_at));
    await api().post("/api/fitness/logs").set(u.auth).send({ title: "x", duration_sec: 60, exercises: [{ exercise_id: "nope" }] }).expect(400);
    const logs = await api().get("/api/fitness/logs").set(u.auth).expect(200);
    await api().delete(`/api/fitness/logs/${logs.body.logs[0].id}`).set(u.auth).expect(204);
  });
});

describe("habits", () => {
  test("create, check (idempotent), streaks, archive and ownership", async () => {
    const u = await signup();
    const other = await signup();
    let r = await api().post("/api/habits").set(u.auth).send({ title: "Read 10 pages", icon: "book", tone: "blue" }).expect(201);
    const id = r.body.habits[0].id;
    assert.equal(r.body.habits[0].done_today, false);
    // Double tap: two "done" requests still mean one check.
    await api().post(`/api/habits/${id}/check`).set(u.auth).send({ done: true }).expect(200);
    r = await api().post(`/api/habits/${id}/check`).set(u.auth).send({ done: true }).expect(200);
    assert.equal(r.body.habits[0].streak, 1);
    assert.equal(r.body.habits[0].last7.filter(Boolean).length, 1);
    const yesterday = new Date(Date.now() - 864e5).toISOString().slice(0, 10);
    r = await api().post(`/api/habits/${id}/check`).set(u.auth).send({ done: true, day: yesterday }).expect(200);
    assert.equal(r.body.habits[0].streak, 2);
    r = await api().post(`/api/habits/${id}/check`).set(u.auth).send({ done: false }).expect(200);
    assert.equal(r.body.habits[0].done_today, false);
    assert.equal(r.body.habits[0].streak, 1, "streak still alive from yesterday");
    await api().post(`/api/habits/${id}/check`).set(other.auth).send({ done: true }).expect(404);
    await api().post("/api/habits").set(u.auth).send({ title: "x", icon: "rocket-launcher" }).expect(400);
    r = await api().patch(`/api/habits/${id}`).set(u.auth).send({ archived: true }).expect(200);
    assert.equal(r.body.habits.length, 0);
  });
});

describe("money", () => {
  test("income, expenses, categories, budget and month filter", async () => {
    const u = await signup();
    await api().post("/api/money/transactions").set(u.auth).send({ kind: "income", amount_cents: 300000, category: "salary" }).expect(201);
    await api().post("/api/money/transactions").set(u.auth).send({ kind: "expense", amount_cents: 4500, category: "food", note: "Coffee" }).expect(201);
    let r = await api().post("/api/money/transactions").set(u.auth).send({ kind: "expense", amount_cents: 12000, category: "transport" }).expect(201);
    assert.equal(r.body.income_cents, 300000);
    assert.equal(r.body.expense_cents, 16500);
    assert.equal(r.body.net_cents, 283500);
    assert.equal(r.body.by_category[0].category, "transport");
    r = await api().put("/api/money/budget").set(u.auth).send({ budget_cents: 50000 }).expect(200);
    assert.equal(r.body.budget_left_cents, 33500);
    await api().post("/api/money/transactions").set(u.auth).send({ kind: "expense", amount_cents: 0, category: "food" }).expect(400);
    await api().post("/api/money/transactions").set(u.auth).send({ kind: "expense", amount_cents: 100, category: "yachts" }).expect(400);
    r = await api().get("/api/money?month=2001-01").set(u.auth).expect(200);
    assert.equal(r.body.transactions.length, 0);
    const now = await api().get("/api/money").set(u.auth).expect(200);
    r = await api().delete(`/api/money/transactions/${now.body.transactions[0].id}`).set(u.auth).expect(200);
    assert.equal(r.body.transactions.length, 2);
  });
});

describe("future me", () => {
  test("letters stay sealed until their date", async () => {
    const u = await signup();
    const other = await signup();
    const later = new Date(Date.now() + 30 * 864e5).toISOString().slice(0, 10);
    let r = await api().post("/api/future").set(u.auth).send({ title: "Dear me", body: "Did you launch the studio?", unlock_on: later }).expect(201);
    const letter = r.body.letters[0];
    assert.equal(letter.unlocked, false);
    assert.equal(letter.body, undefined, "sealed text never leaves the server");
    await api().post(`/api/future/${letter.id}/open`).set(u.auth).expect(403);
    await api().post("/api/future").set(u.auth).send({ title: "x", body: "y", unlock_on: "2000-01-01" }).expect(400);
    await pool.query("UPDATE future_letters SET unlock_on = current_date - 1 WHERE id = $1", [letter.id]);
    r = await api().post(`/api/future/${letter.id}/open`).set(u.auth).expect(200);
    assert.equal(r.body.letter.body, "Did you launch the studio?");
    await api().post(`/api/future/${letter.id}/open`).set(other.auth).expect(404);
    await api().delete(`/api/future/${letter.id}`).set(u.auth).expect(204);
  });
});
