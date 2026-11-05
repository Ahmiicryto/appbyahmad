import Anthropic from "@anthropic-ai/sdk";
import { Router } from "express";
import Stripe from "stripe";
import { requireAdmin, requireAuth } from "../lib/auth.js";
import { badRequest } from "../lib/errors.js";
import { logger } from "../logger.js";
import { audit } from "../services/audit.js";
import { SETTINGS, getSetting, setSetting, settingsForAdmin } from "../services/settings.js";

export const adminSettingsRouter = Router();
adminSettingsRouter.use(requireAuth, requireAdmin);

// Client factories are swappable so tests never reach Anthropic or Stripe.
const defaults = {
  anthropic: (apiKey) => new Anthropic({ apiKey, maxRetries: 0, timeout: 20_000 }),
  stripe: (key) => new Stripe(key, { maxNetworkRetries: 0, timeout: 20_000 })
};
const factories = { ...defaults };
export function setClientFactories(overrides = {}) {
  Object.assign(factories, overrides);
}
export function resetClientFactories() {
  Object.assign(factories, defaults);
}

const GROUPS = ["ai", "limits", "app", "payments", "store", "push"];

async function grouped() {
  const all = await settingsForAdmin();
  const groups = Object.fromEntries(GROUPS.map((g) => [g, {}]));
  for (const [key, s] of Object.entries(all)) (groups[s.group] ??= {})[key] = s;
  return { settings: all, groups };
}

adminSettingsRouter.get("/", async (req, res) => {
  res.json(await grouped());
});

adminSettingsRouter.patch("/", async (req, res) => {
  const body = req.body;
  if (!body || typeof body !== "object" || Array.isArray(body) || !Object.keys(body).length) {
    throw badRequest("Send at least one setting to change.");
  }
  // Validate everything first so a bad field never leaves a half-saved form.
  const fields = {};
  const parsed = {};
  for (const [key, value] of Object.entries(body)) {
    const d = SETTINGS[key];
    if (!d) {
      fields[key] = ["Unknown setting."];
      continue;
    }
    if (value === null) {
      parsed[key] = null;
      continue;
    }
    const r = d.schema.safeParse(value);
    if (r.success) parsed[key] = r.data;
    else fields[key] = r.error.issues.map((i) => (i.path.length ? `${i.path.join(".")}: ${i.message}` : i.message));
  }
  if (Object.keys(fields).length) {
    return res.status(400).json({ error: { code: "validation_error", message: "Some settings need fixing.", fields } });
  }

  for (const [key, value] of Object.entries(parsed)) await setSetting(key, value, req.user.id);

  const keys = Object.keys(parsed);
  const changes = {};
  for (const key of keys) {
    // Secret values never go into the audit log, only whether they were replaced or removed.
    changes[key] = SETTINGS[key].secret ? (parsed[key] === null ? "removed" : "replaced") : parsed[key];
  }
  await audit(req.user.id, "settings.updated", "settings", null, { keys, changes });
  res.json(await grouped());
});

adminSettingsRouter.post("/test-ai", async (req, res) => {
  const apiKey = await getSetting("anthropic_api_key");
  const model = await getSetting("ai_model");
  if (!apiKey) return res.json({ ok: false, model, message: "No API key saved. Add your Anthropic API key, then test again." });
  try {
    await factories.anthropic(apiKey).messages.create({
      model,
      max_tokens: 16,
      messages: [{ role: "user", content: "Reply with OK" }]
    });
    res.json({ ok: true, model });
  } catch (err) {
    res.json({ ok: false, model, message: aiErrorMessage(err, model) });
  }
});

function aiErrorMessage(err, model) {
  if (err instanceof Anthropic.AuthenticationError) return "The API key was rejected. Check it in the Anthropic Console and replace it.";
  if (err instanceof Anthropic.NotFoundError) return `Model "${model}" was not found. Check the model name and save again.`;
  if (err instanceof Anthropic.PermissionDeniedError) return "This key can't use that model. Check your Anthropic plan or pick another model.";
  if (err instanceof Anthropic.RateLimitError) return "Anthropic is rate limiting this key. Wait a minute and try again.";
  if (err instanceof Anthropic.APIConnectionError) return "Couldn't reach Anthropic. Check the server's internet connection and try again.";
  logger.warn({ err: err?.message }, "AI connection test failed");
  return `Anthropic returned an error${err?.status ? ` (${err.status})` : ""}. Try again in a minute.`;
}

adminSettingsRouter.post("/test-stripe", async (req, res) => {
  const key = await getSetting("stripe_secret_key");
  if (!key) return res.json({ ok: false, message: "No Stripe secret key saved. Add it under Payments, then test again." });
  const mode = key.includes("_live_") ? "live" : "test";
  try {
    const balance = await factories.stripe(key).balance.retrieve();
    res.json({ ok: true, mode: balance?.livemode === true ? "live" : balance?.livemode === false ? "test" : mode });
  } catch (err) {
    res.json({ ok: false, mode, message: stripeErrorMessage(err) });
  }
});

function stripeErrorMessage(err) {
  const type = err?.type;
  if (type === "StripeAuthenticationError" || err?.statusCode === 401) return "Stripe rejected the secret key. Copy it again from the Stripe Dashboard and replace it.";
  if (type === "StripePermissionError" || err?.statusCode === 403) return "This restricted key can't read the balance. Give it Balance read access or use a secret key.";
  if (type === "StripeConnectionError") return "Couldn't reach Stripe. Check the server's internet connection and try again.";
  logger.warn({ err: err?.message }, "Stripe connection test failed");
  return "Stripe returned an error. Try again in a minute.";
}
