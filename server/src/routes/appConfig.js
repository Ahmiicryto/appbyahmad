import { Router } from "express";
import { one } from "../db/pool.js";
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
    "signup_open"
  ]);
  const { n } = await one("SELECT count(*)::int AS n FROM plans WHERE active");
  const a = s.announcement;
  res.set("Cache-Control", "no-store");
  res.json({
    maintenance: { on: Boolean(s.maintenance_mode), message: s.maintenance_message },
    announcement: a?.active && a.text ? { text: a.text, level: a.level } : null,
    features: s.feature_flags,
    minAppVersion: s.min_app_version,
    signupOpen: Boolean(s.signup_open),
    plansAvailable: n
  });
});
