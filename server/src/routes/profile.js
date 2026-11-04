import { Router } from "express";
import { z } from "zod";
import { one } from "../db/pool.js";
import { requireAuth } from "../lib/auth.js";
import { isYmd } from "../lib/dates.js";
import { track } from "../services/activity.js";

export const profileRouter = Router();
profileRouter.use(requireAuth);

const THEME_FOR_GENDER = { male: "male", female: "female", unspecified: "neutral" };

const text = (max) => z.string().trim().max(max).nullable().optional();
const ProfileUpdate = z
  .object({
    name: text(80),
    gender: z.enum(["male", "female", "unspecified"]).optional(),
    theme: z.enum(["male", "female", "neutral"]).optional(),
    birth_date: z.string().refine(isYmd, "Use YYYY-MM-DD.").nullable().optional(),
    height_cm: z.number().min(50).max(272).nullable().optional(),
    weight_kg: z.number().min(20).max(400).nullable().optional(),
    occupation: text(120),
    self_word: text(40),
    aspiration: text(200),
    units: z.enum(["metric", "imperial"]).optional(),
    currency: z.string().trim().length(3).toUpperCase().optional(),
    timezone: z.string().trim().max(64).optional(),
    complete_onboarding: z.boolean().optional()
  })
  .strict();

export async function getProfile(userId) {
  const p = await one("SELECT * FROM profiles WHERE user_id = $1", [userId]);
  if (!p) return null;
  return {
    ...p,
    height_cm: p.height_cm == null ? null : Number(p.height_cm),
    weight_kg: p.weight_kg == null ? null : Number(p.weight_kg),
    onboarded: Boolean(p.onboarded_at)
  };
}

profileRouter.get("/", async (req, res) => {
  res.json({ profile: await getProfile(req.user.id) });
});

profileRouter.patch("/", async (req, res) => {
  const { complete_onboarding, ...fields } = ProfileUpdate.parse(req.body);
  // Picking a gender sets the starting theme unless a theme was chosen explicitly.
  if (fields.gender && !fields.theme) fields.theme = THEME_FOR_GENDER[fields.gender];
  const keys = Object.keys(fields);
  const sets = keys.map((k, i) => `${k} = $${i + 2}`);
  if (complete_onboarding) sets.push("onboarded_at = coalesce(onboarded_at, now())");
  if (sets.length) {
    const before = await one("SELECT theme, onboarded_at FROM profiles WHERE user_id = $1", [req.user.id]);
    await one(`UPDATE profiles SET ${sets.join(", ")}, updated_at = now() WHERE user_id = $1`, [
      req.user.id,
      ...keys.map((k) => fields[k])
    ]);
    if (complete_onboarding && before && !before.onboarded_at) track(req.user.id, "onboarding.completed");
    if (fields.theme && before && fields.theme !== before.theme) track(req.user.id, "profile.theme_changed", { theme: fields.theme });
  }
  res.json({ profile: await getProfile(req.user.id) });
});
