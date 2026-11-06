import assert from "node:assert/strict";
import { after, afterEach, before, describe, test } from "node:test";
import { adminSession, api, pool, resetDb, signup } from "./helpers.js";
import { setAnthropicClientForTests, setProviderFetchForTests } from "../src/services/aiProvider.js";
import { setSetting } from "../src/services/settings.js";

before(resetDb);
after(() => pool.end());

const KEYS = ["ai_provider", "ai_model", "openai_api_key", "xai_api_key", "ai_fallback_provider", "ai_fallback_model", "custom_ai_base_url", "custom_ai_api_key"];
afterEach(async () => {
  setProviderFetchForTests(null);
  setAnthropicClientForTests(null);
  for (const k of KEYS) await setSetting(k, null);
});

// Fake OpenAI-style endpoint: records requests, answers from a list.
function fakeFetch(answers) {
  const calls = [];
  const fn = async (url, opts) => {
    const body = JSON.parse(opts.body);
    calls.push({ url, headers: opts.headers, body });
    const a = answers[Math.min(calls.length - 1, answers.length - 1)];
    if (a.status && a.status !== 200) return new Response(JSON.stringify({ error: { message: a.message || "error" } }), { status: a.status });
    return new Response(JSON.stringify({ model: body.model, choices: [{ message: { content: a.content }, finish_reason: "stop" }], usage: { prompt_tokens: 50, completion_tokens: 20 } }), { status: 200 });
  };
  fn.calls = calls;
  return fn;
}

async function useOpenAI(model = "gpt-test") {
  await setSetting("ai_provider", "openai");
  await setSetting("ai_model", model);
  await setSetting("openai_api_key", "sk-openai-test-123456");
}

describe("OpenAI-compatible providers", () => {
  test("chat goes to the chosen provider with the system prompt first", async () => {
    await useOpenAI();
    const f = fakeFetch([{ content: "Start with your landing page." }]);
    setProviderFetchForTests(f);
    const u = await signup();
    const r = await api().post("/api/ai/chat").set(u.auth).send({ text: "What now?" }).expect(200);
    assert.equal(r.body.message.content, "Start with your landing page.");
    assert.equal(f.calls[0].url, "https://api.openai.com/v1/chat/completions");
    assert.equal(f.calls[0].headers.Authorization, "Bearer sk-openai-test-123456");
    assert.equal(f.calls[0].body.model, "gpt-test");
    assert.equal(f.calls[0].body.messages[0].role, "system");
    assert.match(f.calls[0].body.messages[0].content, /Elauxi/);
    const usage = await pool.query("SELECT model FROM ai_usage WHERE user_id = $1", [u.user.id]);
    assert.equal(usage.rows[0].model, "openai:gpt-test");
  });

  test("structured answers use JSON mode, are validated, and get one corrective retry", async () => {
    await useOpenAI();
    const good = JSON.stringify({ headline: "Good week.", wins: ["A"], patterns: ["B"], next_week: ["C", "D", "E"] });
    const f = fakeFetch([{ content: "Sure! Here you go" }, { content: "```json\n" + good + "\n```" }]);
    setProviderFetchForTests(f);
    const u = await signup();
    const r = await api().post("/api/ai/weekly-review").set(u.auth).expect(200);
    assert.equal(r.body.review.headline, "Good week.");
    assert.equal(f.calls.length, 2);
    assert.deepEqual(f.calls[0].body.response_format, { type: "json_object" });
    assert.match(f.calls[0].body.messages[0].content, /JSON Schema/);
  });

  test("Grok and custom providers use their own URLs", async () => {
    await setSetting("ai_provider", "xai");
    await setSetting("ai_model", "grok-test");
    await setSetting("xai_api_key", "xai-test-key-123456");
    let f = fakeFetch([{ content: "Hi from Grok" }]);
    setProviderFetchForTests(f);
    const u = await signup();
    await api().post("/api/ai/chat").set(u.auth).send({ text: "hi" }).expect(200);
    assert.equal(f.calls[0].url, "https://api.x.ai/v1/chat/completions");

    await setSetting("ai_provider", "custom");
    await setSetting("custom_ai_base_url", "https://llm.example.com/v1/");
    await setSetting("custom_ai_api_key", "custom-key");
    f = fakeFetch([{ content: "Hi from custom" }]);
    setProviderFetchForTests(f);
    await api().post("/api/ai/chat").set(u.auth).send({ text: "hi" }).expect(200);
    assert.equal(f.calls[0].url, "https://llm.example.com/v1/chat/completions");
  });

  test("a rejected key shows users a calm message, not the provider error", async () => {
    await useOpenAI();
    setProviderFetchForTests(fakeFetch([{ status: 401, message: "Incorrect API key provided: sk-..." }]));
    const u = await signup();
    const r = await api().post("/api/ai/chat").set(u.auth).send({ text: "hi" }).expect(503);
    assert.equal(r.body.error.code, "ai_unavailable");
    assert.ok(!JSON.stringify(r.body).includes("sk-"));
  });

  test("the backup provider answers when the main one fails", async () => {
    await useOpenAI();
    await setSetting("ai_fallback_provider", "anthropic");
    await setSetting("ai_fallback_model", "claude-opus-5-5");
    await setSetting("anthropic_api_key", "sk-ant-test-1234567890");
    setProviderFetchForTests(fakeFetch([{ status: 500, message: "boom" }]));
    const claudeCalls = [];
    setAnthropicClientForTests({
      beta: { messages: { create: async (req) => { claudeCalls.push(req); return { model: req.model, stop_reason: "end_turn", usage: { input_tokens: 1, output_tokens: 1 }, content: [{ type: "text", text: "Backup here." }] }; } } }
    });
    const u = await signup();
    const r = await api().post("/api/ai/chat").set(u.auth).send({ text: "hi" }).expect(200);
    assert.equal(r.body.message.content, "Backup here.");
    assert.equal(claudeCalls[0].model, "claude-opus-5-5");
    await setSetting("anthropic_api_key", null);
  });
});

describe("admin AI settings", () => {
  test("provider, keys and backup save; secrets stay hidden; test connection works per provider", async () => {
    const admin = await adminSession();
    await api().patch("/api/admin/settings").set(admin.auth)
      .send({ ai_provider: "openai", ai_model: "gpt-test", openai_api_key: "sk-openai-secret-999", ai_fallback_provider: "none" })
      .expect(200);
    const s = await api().get("/api/admin/settings").set(admin.auth).expect(200);
    assert.equal(s.body.groups.ai.ai_provider.value, "openai");
    assert.equal(s.body.groups.ai.openai_api_key.configured, true);
    assert.ok(!JSON.stringify(s.body).includes("sk-openai-secret-999"));

    await api().patch("/api/admin/settings").set(admin.auth).send({ ai_provider: "skynet" }).expect(400);
    await api().patch("/api/admin/settings").set(admin.auth).send({ custom_ai_base_url: "http://insecure.example.com" }).expect(400);

    setProviderFetchForTests(fakeFetch([{ content: "OK" }]));
    let r = await api().post("/api/admin/settings/test-ai").set(admin.auth).send({}).expect(200);
    assert.equal(r.body.ok, true);
    assert.equal(r.body.provider, "openai");

    setProviderFetchForTests(fakeFetch([{ status: 404, message: "The model `gpt-test` does not exist" }]));
    r = await api().post("/api/admin/settings/test-ai").set(admin.auth).send({}).expect(200);
    assert.equal(r.body.ok, false);
    assert.match(r.body.message, /does not exist/);

    r = await api().post("/api/admin/settings/test-ai").set(admin.auth).send({ which: "fallback" }).expect(200);
    assert.equal(r.body.ok, false);
    assert.match(r.body.message, /No backup/);
  });
});
