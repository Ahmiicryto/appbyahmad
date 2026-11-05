import { Router } from "express";
import { one } from "../db/pool.js";
import { storeConfig } from "../services/revenuecat.js";
import { getSettings } from "../services/settings.js";

// Public remote config for the phone app: read on launch, every few minutes and on foreground.
export const appConfigRouter = Router();

appConfigRouter.get("/", async (req, res) => {
  const s = await getSettings([
    "maintenance_mode",
    "maintenance_message",
    "announcement",
    "feature_flags",
    "min_app_version",
    "signup_open",
    "terms_url",
    "privacy_url",
    "support_email"
  ]);
  const { n } = await one("SELECT count(*)::int AS n FROM plans WHERE active");
  const store = await storeConfig();
  const a = s.announcement;
  res.set("Cache-Control", "no-store");
  res.json({
    maintenance: { on: Boolean(s.maintenance_mode), message: s.maintenance_message },
    announcement: a?.active && a.text ? { text: a.text, level: a.level } : null,
    features: s.feature_flags,
    minAppVersion: s.min_app_version,
    signupOpen: Boolean(s.signup_open),
    plansAvailable: n,
    legal: { termsUrl: s.terms_url || null, privacyUrl: s.privacy_url || null, supportEmail: s.support_email || null },
    // RevenueCat public SDK keys (safe to ship to the app; the secret key never leaves the server).
    purchases: { enabled: store.enabled, iosKey: store.iosKey, androidKey: store.androidKey, entitlement: store.entitlement }
  });
});
