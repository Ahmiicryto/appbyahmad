// One interface for every AI provider the admin can pick: Claude (Anthropic SDK) or any provider with an
// OpenAI-style chat completions API (ChatGPT, Grok, Gemini, DeepSeek, Groq, Mistral, OpenRouter, or a custom URL).
// Admin → Settings → AI chooses the provider, model and keys; an optional backup provider takes over on failure.
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import { query } from "../db/pool.js";
import { logger } from "../logger.js";
import { getSetting } from "./settings.js";

export const PROVIDERS = {
  anthropic: { label: "Claude (Anthropic)", key: "anthropic_api_key", console: "console.anthropic.com" },
  openai: { label: "ChatGPT (OpenAI)", key: "openai_api_key", baseUrl: "https://api.openai.com/v1", console: "platform.openai.com" },
  xai: { label: "Grok (xAI)", key: "xai_api_key", baseUrl: "https://api.x.ai/v1", console: "console.x.ai" },
  gemini: { label: "Gemini (Google)", key: "gemini_api_key", baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai", console: "aistudio.google.com" },
  deepseek: { label: "DeepSeek", key: "deepseek_api_key", baseUrl: "https://api.deepseek.com/v1", console: "platform.deepseek.com" },
  groq: { label: "Groq", key: "groq_api_key", baseUrl: "https://api.groq.com/openai/v1", console: "console.groq.com" },
  mistral: { label: "Mistral", key: "mistral_api_key", baseUrl: "https://api.mistral.ai/v1", console: "console.mistral.ai" },
  openrouter: { label: "OpenRouter (any model)", key: "openrouter_api_key", baseUrl: "https://openrouter.ai/api/v1", console: "openrouter.ai" },
  custom: { label: "Custom (OpenAI-compatible URL)", key: "custom_ai_api_key", console: null }
};
export const PROVIDER_IDS = Object.keys(PROVIDERS);

// A provider failure the caller can explain: kind = auth | rate | model | refusal | bad_output | network | other.
export class ProviderError extends Error {
  constructor(kind, message, status = null) {
    super(message);
    this.kind = kind;
    this.status = status;
  }
}

// ---------------------------------------------------------------- test hooks

let testAnthropic = null;
let fetchImpl = (...a) => fetch(...a);
export const setAnthropicClientForTests = (c) => (testAnthropic = c);
export const setProviderFetchForTests = (fn) => (fetchImpl = fn || ((...a) => fetch(...a)));

// ---------------------------------------------------------------- config

async function target(which = "primary") {
  if (which === "fallback") {
    const provider = await getSetting("ai_fallback_provider");
    if (!provider || provider === "none" || !PROVIDERS[provider]) return null;
    const model = await getSetting("ai_fallback_model");
    const key = await getSetting(PROVIDERS[provider].key);
    if (!model || !key) return null;
    return { provider, model, key, baseUrl: await baseUrlFor(provider) };
  }
  const provider = PROVIDERS[await getSetting("ai_provider")] ? await getSetting("ai_provider") : "anthropic";
  return { provider, model: await getSetting("ai_model"), key: await getSetting(PROVIDERS[provider].key), baseUrl: await baseUrlFor(provider) };
}

async function baseUrlFor(provider) {
  if (provider === "custom") return ((await getSetting("custom_ai_base_url")) || "").replace(/\/$/, "");
  return PROVIDERS[provider].baseUrl || null;
}

// AI is usable when it's switched on and the chosen provider has a key (tests may inject a client).
export async function aiConfigured() {
  if (!(await getSetting("ai_enabled"))) return false;
  const t = await target();
  if (t.provider === "anthropic" && testAnthropic) return true;
  return Boolean(t.key && t.model && (t.provider === "anthropic" || t.baseUrl));
}

export async function activeProvider() {
  const t = await target();
  return { provider: t.provider, label: PROVIDERS[t.provider].label, model: t.model };
}

export async function recordUsage(userId, kind, { model, input = 0, output = 0, provider }) {
  await query("INSERT INTO ai_usage (user_id, kind, model, input_tokens, output_tokens) VALUES ($1, $2, $3, $4, $5)", [
    userId,
    kind,
    provider && provider !== "anthropic" ? `${provider}:${model}` : model,
    input,
    output
  ]).catch((err) => logger.warn({ err: err.message }, "failed to record AI usage"));
}

// ---------------------------------------------------------------- Claude

let client;
let clientKey;
function anthropicClient(key) {
  if (testAnthropic) return testAnthropic;
  if (!client || clientKey !== key) {
    client = new Anthropic({ apiKey: key, timeout: 90_000, maxRetries: 1 });
    clientKey = key;
  }
  return client;
}
// If Claude's main model declines, the API re-runs the request on a fallback Claude model.
const CLAUDE_FALLBACK = { betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" };

function claudeError(err) {
  if (err instanceof ProviderError) return err;
  if (err instanceof Anthropic.AuthenticationError || err instanceof Anthropic.PermissionDeniedError) return new ProviderError("auth", "Anthropic rejected the API key.", err.status);
  if (err instanceof Anthropic.NotFoundError) return new ProviderError("model", "Anthropic doesn't know that model name.", 404);
  if (err instanceof Anthropic.RateLimitError) return new ProviderError("rate", "Anthropic is rate limiting this key.", 429);
  if (err instanceof Anthropic.APIConnectionError) return new ProviderError("network", "Couldn't reach Anthropic.");
  return new ProviderError("other", `Anthropic returned an error${err?.status ? ` (${err.status})` : ""}.`, err?.status);
}

async function claudeText(t, { system, messages, effort }) {
  try {
    const r = await anthropicClient(t.key).beta.messages.create({ model: t.model, max_tokens: 16000, ...CLAUDE_FALLBACK, output_config: { effort }, system, messages });
    if (r.stop_reason === "refusal") throw new ProviderError("refusal", "The model declined this request.");
    const text = r.content.filter((b) => b.type === "text").map((b) => b.text).join("\n").trim();
    return { text, usage: { model: r.model ?? t.model, input: r.usage?.input_tokens ?? 0, output: r.usage?.output_tokens ?? 0 } };
  } catch (err) {
    throw claudeError(err);
  }
}

async function claudeStructured(t, { system, content, schema, effort }) {
  try {
    const r = await anthropicClient(t.key).beta.messages.parse({
      model: t.model, max_tokens: 16000, ...CLAUDE_FALLBACK,
      output_config: { format: zodOutputFormat(schema), effort },
      system, messages: [{ role: "user", content }]
    });
    const usage = { model: r.model ?? t.model, input: r.usage?.input_tokens ?? 0, output: r.usage?.output_tokens ?? 0 };
    if (r.stop_reason === "refusal") throw Object.assign(new ProviderError("refusal", "The model declined this request."), { usage });
    if (!r.parsed_output) throw Object.assign(new ProviderError("bad_output", "The model returned an unexpected answer."), { usage });
    return { data: r.parsed_output, usage };
  } catch (err) {
    throw Object.assign(claudeError(err), { usage: err?.usage });
  }
}

// ---------------------------------------------------------------- OpenAI-compatible providers

async function chat(t, body) {
  if (!t.baseUrl) throw new ProviderError("other", "No API URL set for the custom provider.");
  let res;
  try {
    res = await fetchImpl(`${t.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${t.key}`,
        ...(t.provider === "openrouter" ? { "HTTP-Referer": "https://elauxi.app", "X-Title": "Elauxi" } : {})
      },
      body: JSON.stringify({ model: t.model, ...body }),
      signal: AbortSignal.timeout(90_000)
    });
  } catch (err) {
    throw new ProviderError("network", `Couldn't reach ${PROVIDERS[t.provider].label}.`);
  }
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const msg = String(data?.error?.message || data?.message || "").slice(0, 200);
    if (res.status === 401 || res.status === 403) throw new ProviderError("auth", `${PROVIDERS[t.provider].label} rejected the API key.`, res.status);
    if (res.status === 404 || /model/i.test(msg)) throw new ProviderError("model", `${PROVIDERS[t.provider].label}: ${msg || "model not found"}.`, res.status);
    if (res.status === 429) throw new ProviderError("rate", `${PROVIDERS[t.provider].label} is rate limiting this key (or the account is out of credit).`, 429);
    throw new ProviderError("other", `${PROVIDERS[t.provider].label} returned an error (${res.status})${msg ? `: ${msg}` : ""}.`, res.status);
  }
  const choice = data?.choices?.[0];
  if (choice?.finish_reason === "content_filter") throw new ProviderError("refusal", "The model declined this request.");
  return {
    text: String(choice?.message?.content ?? "").trim(),
    usage: { model: data?.model ?? t.model, input: data?.usage?.prompt_tokens ?? 0, output: data?.usage?.completion_tokens ?? 0 }
  };
}

async function compatText(t, { system, messages }) {
  const r = await chat(t, { messages: [{ role: "system", content: system }, ...messages] });
  if (!r.text) throw new ProviderError("bad_output", "The model returned an empty answer.");
  return r;
}

// JSON mode + the schema in the prompt, validated with zod; one corrective retry.
async function compatStructured(t, { system, content, schema }) {
  const jsonSchema = JSON.stringify(z.toJSONSchema(schema));
  const sys = `${system}\n\nReply with ONLY a JSON object that matches this JSON Schema (no prose, no code fences):\n${jsonSchema}`;
  const messages = [{ role: "system", content: sys }, { role: "user", content }];
  let usage = { model: t.model, input: 0, output: 0 };
  for (let attempt = 0; attempt < 2; attempt++) {
    const r = await chat(t, { messages, response_format: { type: "json_object" } });
    usage = { model: r.usage.model, input: usage.input + r.usage.input, output: usage.output + r.usage.output };
    const raw = r.text.replace(/^```(?:json)?\s*|\s*```$/g, "");
    let parsed = null;
    try {
      parsed = schema.safeParse(JSON.parse(raw));
    } catch {
      parsed = null;
    }
    if (parsed?.success) return { data: parsed.data, usage };
    messages.push({ role: "assistant", content: r.text }, { role: "user", content: "That didn't match the schema. Reply again with only the corrected JSON object." });
  }
  throw Object.assign(new ProviderError("bad_output", "The model returned an answer in the wrong format."), { usage });
}

// ---------------------------------------------------------------- public API

async function run(op, args, { userId, kind }) {
  const primary = await target();
  const tries = [primary];
  const fb = await target("fallback");
  if (fb && !(fb.provider === primary.provider && fb.model === primary.model)) tries.push(fb);
  let lastErr;
  for (const t of tries) {
    try {
      const fn = t.provider === "anthropic" ? (op === "text" ? claudeText : claudeStructured) : op === "text" ? compatText : compatStructured;
      const r = await fn(t, args);
      if (userId !== undefined) await recordUsage(userId, kind, { ...r.usage, provider: t.provider });
      return r;
    } catch (err) {
      lastErr = err instanceof ProviderError ? err : new ProviderError("other", err?.message || "AI request failed.");
      if (err?.usage && userId !== undefined) await recordUsage(userId, kind, { ...err.usage, provider: t.provider });
      logger.warn({ provider: t.provider, model: t.model, kind: lastErr.kind, msg: lastErr.message }, "AI provider call failed");
      // A refusal on the backup is final; a refusal or outage on the main provider tries the backup.
    }
  }
  throw lastErr;
}

export async function generateText({ system, messages, effort = "low", userId, kind }) {
  return (await run("text", { system, messages, effort }, { userId, kind })).text;
}

export async function generateStructured({ system, content, schema, effort = "low", userId, kind }) {
  return (await run("structured", { system, content, schema, effort }, { userId, kind })).data;
}

// Admin "Test connection": a tiny request to the chosen provider, with a human-readable result.
export async function testProvider(which = "primary") {
  const t = await target(which);
  if (!t) return { ok: false, message: "No backup provider is set up." };
  const label = PROVIDERS[t.provider].label;
  if (!t.key) return { ok: false, provider: t.provider, model: t.model, message: `No ${label} API key saved. Add it, then test again.` };
  try {
    const fn = t.provider === "anthropic" ? claudeText : compatText;
    await fn(t, { system: "Reply with the single word OK.", messages: [{ role: "user", content: "Reply with OK" }], effort: "low" });
    return { ok: true, provider: t.provider, label, model: t.model };
  } catch (err) {
    return { ok: false, provider: t.provider, label, model: t.model, message: err.message };
  }
}
