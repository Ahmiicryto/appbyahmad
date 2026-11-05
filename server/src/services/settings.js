import { z } from "zod";
import { config } from "../config.js";
import { query } from "../db/pool.js";
import { decrypt, encrypt } from "../lib/crypto.js";
import { logger } from "../logger.js";

// Every live setting the admin can change without a redeploy.
// `env` = fallback from environment variables until an admin saves a value.
export const SETTINGS = {
  // AI
  anthropic_api_key: { secret: true, schema: z.string().trim().min(10).max(500), env: () => config.ANTHROPIC_API_KEY, group: "ai", label: "Anthropic API key" },
  ai_model: { schema: z.string().trim().min(3).max(100), default: () => config.AI_MODEL, group: "ai", label: "AI model" },
  ai_enabled: { schema: z.boolean(), default: () => true, group: "ai", label: "AI features on" },

  // Plans & limits
  free_active_goals: { schema: z.number().int().min(0).max(100), default: () => config.FREE_ACTIVE_GOALS, group: "limits", label: "Free plan: active goals" },
  free_ai_plans_per_month: { schema: z.number().int().min(0).max(1000), default: () => config.FREE_AI_PLANS_PER_MONTH, group: "limits", label: "Free plan: AI plans per month" },

  // App behaviour
  signup_open: { schema: z.boolean(), default: () => config.ALLOW_SIGNUP, group: "app", label: "New sign-ups allowed" },
  maintenance_mode: { schema: z.boolean(), default: () => false, group: "app", label: "Maintenance mode" },
  maintenance_message: { schema: z.string().trim().max(300), default: () => "We're improving the app. Please try again in a few minutes.", group: "app", label: "Maintenance message" },
  announcement: {
    schema: z.object({ active: z.boolean(), text: z.string().trim().max(200), level: z.enum(["info", "success", "warning"]) }),
    default: () => ({ active: false, text: "", level: "info" }),
    group: "app",
    label: "Announcement banner"
  },
  feature_flags: {
    schema: z.object({
      journal: z.boolean(), money: z.boolean(), fitness: z.boolean(), nutrition: z.boolean(),
      career: z.boolean(), future_me: z.boolean(), decisions: z.boolean(), assistant: z.boolean()
    }),
    default: () => ({ journal: true, money: false, fitness: false, nutrition: false, career: false, future_me: false, decisions: false, assistant: false }),
    group: "app",
    label: "Features visible in the app"
  },
  min_app_version: { schema: z.string().trim().regex(/^\d+\.\d+\.\d+$/), default: () => "1.0.0", group: "app", label: "Minimum app version" },

  // Payments (Stripe)
  stripe_secret_key: { secret: true, schema: z.string().trim().regex(/^(sk|rk)_(test|live)_/, "Starts with sk_test_, sk_live_, rk_test_ or rk_live_"), group: "payments", label: "Stripe secret key" },
  stripe_webhook_secret: { secret: true, schema: z.string().trim().regex(/^whsec_/, "Starts with whsec_"), group: "payments", label: "Stripe webhook signing secret" },
  stripe_publishable_key: { schema: z.string().trim().regex(/^pk_(test|live)_/, "Starts with pk_test_ or pk_live_"), group: "payments", label: "Stripe publishable key" },
  checkout_success_url: { schema: z.url(), default: () => "", group: "payments", label: "After-payment page" },
  checkout_cancel_url: { schema: z.url(), default: () => "", group: "payments", label: "Cancelled-payment page" },

  // In-app purchases (RevenueCat → App Store / Google Play)
  revenuecat_ios_key: { schema: z.string().trim().regex(/^appl_[A-Za-z0-9]+$/, "Starts with appl_"), default: () => "", group: "store", label: "RevenueCat Apple public key" },
  revenuecat_android_key: { schema: z.string().trim().regex(/^goog_[A-Za-z0-9]+$/, "Starts with goog_"), default: () => "", group: "store", label: "RevenueCat Google public key" },
  revenuecat_secret_key: { secret: true, schema: z.string().trim().regex(/^sk_[A-Za-z0-9]+$/, "Starts with sk_"), group: "store", label: "RevenueCat secret API key" },
  revenuecat_webhook_auth: { secret: true, schema: z.string().trim().min(16, "Use at least 16 characters").max(200), group: "store", label: "RevenueCat webhook password" },
  revenuecat_entitlement: { schema: z.string().trim().regex(/^[A-Za-z0-9_.-]{1,64}$/, "Letters, numbers, dots, dashes, underscores"), default: () => "premium", group: "store", label: "RevenueCat entitlement ID" },

  // Push notifications (optional; Expo push works without it unless "enhanced security" is on in Expo)
  expo_access_token: { secret: true, schema: z.string().trim().min(10).max(500), group: "push", label: "Expo access token" }
};

const TTL_MS = 15_000;
let cache = null;
let cacheAt = 0;

async function load() {
  if (cache && Date.now() - cacheAt < TTL_MS) return cache;
  const { rows } = await query("SELECT key, value, secret, updated_at FROM settings");
  cache = new Map(rows.map((r) => [r.key, r]));
  cacheAt = Date.now();
  return cache;
}

export function invalidateSettings() {
  cache = null;
}

function def(key) {
  const d = SETTINGS[key];
  if (!d) throw new Error(`Unknown setting: ${key}`);
  return d;
}

// Value an admin saved, else the default / environment fallback. Secrets come back decrypted.
export async function getSetting(key) {
  const d = def(key);
  const row = (await load()).get(key);
  if (row) return d.secret ? readSecret(key, row) : row.value.v;
  if (d.secret) return d.env?.() || null;
  return d.default ? d.default() : null;
}

// A secret saved under a different ENCRYPTION_KEY can't be read: treat it as not set
// (the admin page flags it so it can be re-entered) instead of failing every request.
function readSecret(key, row) {
  try {
    return decrypt(row.value.enc);
  } catch {
    logger.warn({ key }, "saved secret can't be decrypted (ENCRYPTION_KEY changed?); re-enter it in admin Settings");
    return null;
  }
}

export async function getSettings(keys) {
  return Object.fromEntries(await Promise.all(keys.map(async (k) => [k, await getSetting(k)])));
}

// Validates, encrypts secrets, saves. `null` clears the saved value (back to default/env).
export async function setSetting(key, value, actorId = null) {
  const d = def(key);
  if (value === null) {
    await query("DELETE FROM settings WHERE key = $1", [key]);
  } else {
    const parsed = d.schema.parse(value);
    const stored = d.secret ? { enc: encrypt(parsed) } : { v: parsed };
    await query(
      `INSERT INTO settings (key, value, secret, updated_by) VALUES ($1, $2, $3, $4)
       ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, secret = EXCLUDED.secret, updated_by = EXCLUDED.updated_by, updated_at = now()`,
      [key, stored, Boolean(d.secret), actorId]
    );
  }
  invalidateSettings();
}

// For the admin screen: secrets are never sent back, only whether they're set and their last 4 characters.
export async function settingsForAdmin() {
  const rows = await load();
  const out = {};
  for (const [key, d] of Object.entries(SETTINGS)) {
    const row = rows.get(key);
    if (d.secret) {
      const v = await getSetting(key);
      out[key] = {
        group: d.group, label: d.label, secret: true, configured: Boolean(v),
        unreadable: Boolean(row && !v),
        source: row ? "admin" : v ? "env" : "none",
        hint: v ? `••••${String(v).slice(-4)}` : null,
        updated_at: row?.updated_at ?? null
      };
    } else {
      out[key] = { group: d.group, label: d.label, secret: false, value: await getSetting(key), source: row ? "admin" : "default", updated_at: row?.updated_at ?? null };
    }
  }
  return out;
}
