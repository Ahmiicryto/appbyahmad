import assert from "node:assert/strict";
import { after, afterEach, before, describe, test } from "node:test";
import { api, pool, resetDb, signup } from "./helpers.js";
import { setAiClientForTests } from "../src/services/ai.js";
import { setSetting } from "../src/services/settings.js";

before(resetDb);
after(() => pool.end());

// Fake Anthropic client: records requests, returns canned answers.
function fakeClient({ text = "Focus on your landing page first.", parsed = null, stop = "end_turn" } = {}) {
  const calls = [];
  const usage = { input_tokens: 100, output_tokens: 50 };
  return {
    calls,
    beta: {
      messages: {
        create: async (req) => {
          calls.push(["create", req]);
          return { model: req.model, stop_reason: stop, usage, content: [{ type: "text", text }] };
        },
        parse: async (req) => {
          calls.push(["parse", req]);
          return { model: req.model, stop_reason: stop, usage, content: [], parsed_output: parsed };
        }
      }
    }
  };
}

afterEach(() => setAiClientForTests(null));

describe("AI assistant", () => {
  test("without an AI key the built-in coach answers from the user's data", async () => {
    const u = await signup();
    await api().post("/api/tasks").set(u.auth).send({ title: "Call the bank" }).expect(201);
    let r = await api().post("/api/ai/chat").set(u.auth).send({ text: "What should I focus on today?" }).expect(200);
    assert.equal(r.body.source, "builtin");
    assert.match(r.body.message.content, /Call the bank/);
    assert.equal(r.body.usage.used, 0, "built-in answers don't use AI requests");
    r = await api().post("/api/ai/plan-day").set(u.auth).expect(200);
    assert.equal(r.body.source, "builtin");
    assert.ok(r.body.tasks.length >= 2);
    r = await api().post("/api/ai/weekly-review").set(u.auth).expect(200);
    assert.match(r.body.review.headline, /tasks|quiet/);
  });

  test("chat replies, is grounded in the user's data, and keeps encrypted history", async () => {
    const u = await signup();
    await api().patch("/api/profile").set(u.auth).send({ name: "Hamza", occupation: "Designer" }).expect(200);
    const fake = fakeClient();
    setAiClientForTests(fake);
    const r = await api().post("/api/ai/chat").set(u.auth).send({ text: "What should I focus on?" }).expect(200);
    assert.equal(r.body.message.content, "Focus on your landing page first.");
    assert.equal(r.body.usage.used, 1);

    const req = fake.calls[0][1];
    assert.equal(req.model, "claude-opus-5-5");
    assert.equal(req.fallbacks, "default");
    assert.match(req.system, /"name":"Hamza"/);
    assert.deepEqual(req.messages.at(-1), { role: "user", content: "What should I focus on?" });

    // Stored encrypted, returned decrypted.
    const raw = await pool.query("SELECT content_enc FROM ai_messages WHERE user_id = $1", [u.user.id]);
    assert.equal(raw.rows.length, 2);
    assert.ok(!raw.rows.some((x) => x.content_enc.includes("focus")));
    const hist = await api().get("/api/ai/chat").set(u.auth).expect(200);
    assert.deepEqual(hist.body.messages.map((m) => m.role), ["user", "assistant"]);

    // Next turn sends the history back.
    await api().post("/api/ai/chat").set(u.auth).send({ text: "And tomorrow?" }).expect(200);
    assert.equal(fake.calls[1][1].messages.length, 3);

    await api().delete("/api/ai/chat").set(u.auth).expect(204);
    assert.equal((await api().get("/api/ai/chat").set(u.auth)).body.messages.length, 0);
  });

  test("free daily limit returns 402 with an upgrade message", async () => {
    const u = await signup();
    setAiClientForTests(fakeClient());
    await setSetting("free_ai_requests_per_day", 2);
    try {
      await api().post("/api/ai/chat").set(u.auth).send({ text: "one" }).expect(200);
      await api().post("/api/ai/chat").set(u.auth).send({ text: "two" }).expect(200);
      const r = await api().post("/api/ai/chat").set(u.auth).send({ text: "three" }).expect(402);
      assert.equal(r.body.error.code, "ai_limit");
    } finally {
      await setSetting("free_ai_requests_per_day", null);
    }
  });

  test("a refusal becomes a friendly error and empty messages are rejected", async () => {
    const u = await signup();
    setAiClientForTests(fakeClient({ stop: "refusal" }));
    const r = await api().post("/api/ai/chat").set(u.auth).send({ text: "something" }).expect(422);
    assert.equal(r.body.error.code, "ai_refused");
    await api().post("/api/ai/chat").set(u.auth).send({ text: "   " }).expect(400);
  });
});

describe("Plan my day", () => {
  test("suggests tasks, keeps only real goal ids, and they can be added", async () => {
    const u = await signup();
    const goal = await api().post("/api/goals").set(u.auth).send({ title: "Launch my design studio", category: "business" });
    const goalId = goal.body.goal?.id;
    setAiClientForTests(fakeClient({
      parsed: {
        summary: "Momentum day: one deep-work block on the studio.",
        tasks: [
          { title: "Draft the services page", goal_id: goalId ?? null, source: "goal", minutes: 60, time_of_day: "morning", why: "Moves your studio launch forward." },
          { title: "20-minute walk", goal_id: "00000000-0000-0000-0000-000000000000", source: "fitness", minutes: 20, time_of_day: "evening", why: "Your energy dips after 6 PM." }
        ]
      }
    }));
    const r = await api().post("/api/ai/plan-day").set(u.auth).expect(200);
    assert.equal(r.body.tasks.length, 2);
    assert.equal(r.body.tasks[1].goal_id, null, "made-up goal ids are dropped");
    assert.equal(r.body.tasks[0].source, "custom");
    const t = r.body.tasks[0];
    await api().post("/api/tasks").set(u.auth).send({ title: t.title, ...(t.goal_id ? { goal_id: t.goal_id } : { source: t.source }) }).expect(201);
  });
});

describe("Journal reflection", () => {
  test("reflects once, caches the result, and never leaks other users' entries", async () => {
    const u = await signup();
    const other = await signup();
    const e = await api().post("/api/journal").set(u.auth).send({ body: "Finished the landing page. Proud but tired.", mood: "good" });
    const id = e.body.entry?.id ?? e.body.id;
    const fake = fakeClient({ parsed: { reflection: "You pushed through and it paid off.", themes: ["Pride", "Rest"], suggestion: "Start tomorrow with an easy win." } });
    setAiClientForTests(fake);
    const r = await api().post(`/api/ai/journal/${id}/reflect`).set(u.auth).expect(200);
    assert.equal(r.body.cached, false);
    assert.deepEqual(r.body.themes, ["Pride", "Rest"]);
    assert.match(fake.calls[0][1].messages[0].content, /landing page/);

    const again = await api().post(`/api/ai/journal/${id}/reflect`).set(u.auth).expect(200);
    assert.equal(again.body.cached, true);
    assert.equal(fake.calls.length, 1);

    const list = await api().get("/api/journal").set(u.auth).expect(200);
    assert.equal(list.body.entries[0].reflection.suggestion, "Start tomorrow with an easy win.");

    await api().post(`/api/ai/journal/${id}/reflect`).set(other.auth).expect(404);
  });
});

describe("Weekly review", () => {
  test("is generated on request and cached for the week", async () => {
    const u = await signup();
    let r = await api().get("/api/ai/weekly-review").set(u.auth).expect(200);
    assert.equal(r.body.review, null);
    assert.match(r.body.week_start, /^\d{4}-\d{2}-\d{2}$/);
    const fake = fakeClient({ parsed: { headline: "A quiet start.", wins: ["You set a goal."], patterns: ["Few tasks logged."], next_week: ["Plan each morning", "Log 3 tasks", "One journal entry"] } });
    setAiClientForTests(fake);
    r = await api().post("/api/ai/weekly-review").set(u.auth).expect(200);
    assert.equal(r.body.review.headline, "A quiet start.");
    assert.equal(fake.calls[0][1].output_config.effort, "medium");
    r = await api().get("/api/ai/weekly-review").set(u.auth).expect(200);
    assert.deepEqual(r.body.review.next_week, ["Plan each morning", "Log 3 tasks", "One journal entry"]);
  });

  test("AI usage is recorded for the admin dashboard", async () => {
    const { rows } = await pool.query("SELECT kind, count(*)::int AS n FROM ai_usage GROUP BY kind ORDER BY kind");
    const kinds = rows.map((r) => r.kind);
    for (const k of ["coach.chat", "coach.plan_day", "coach.reflect", "coach.weekly_review"]) assert.ok(kinds.includes(k), k);
  });
});
