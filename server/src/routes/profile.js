import { Router } from "express";
import { z } from "zod";
import { one, query } from "../db/pool.js";
import { requireAuth } from "../lib/auth.js";
import { addDays, isYmd, todayIn } from "../lib/dates.js";
import { track } from "../services/activity.js";

export const profileRouter = Router();
profileRouter.use(requireAuth);

const THEME_FOR_GENDER = { male: "male", female: "female", unspecified: "neutral" };

const text = (max) => z.string().trim().max(max).nullable().optional();

// A small photo (data URL, resized on the phone) or a short emoji.
const Avatar = z
  .string()
  .max(150_000, "Photo is too large. Pick a smaller one.")
  .refine(
    (v) => /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(v) || (!v.startsWith("data:") && [...v].length <= 8 && !/[<>"'&]/.test(v)),
    "Use a JPEG, PNG or WebP photo, or one emoji."
  )
  .nullable()
  .optional();
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
    avatar: Avatar,
    phone: z.string().trim().max(32).regex(/^[0-9+()\-.\s]*$/, "Use numbers, spaces and + ( ) - only.").nullable().optional(),
    country: text(60),
    appearance: z.enum(["auto", "light", "dark"]).optional(),
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

// Numbers for the profile header: streak, goals, journal entries, member since.
profileRouter.get("/stats", async (req, res) => {
  const p = await one("SELECT timezone FROM profiles WHERE user_id = $1", [req.user.id]);
  const today = todayIn(p?.timezone || "UTC");
  const { rows } = await query(
    `SELECT DISTINCT due_date::text AS d FROM tasks
      WHERE user_id = $1 AND done_at IS NOT NULL AND due_date > $2::date - 400 AND due_date <= $2::date
      ORDER BY d DESC`,
    [req.user.id, today]
  );
  const days = new Set(rows.map((r) => r.d));
  // A streak is still alive if today isn't done yet but yesterday was.
  let day = days.has(today) ? today : addDays(today, -1);
  let streak = 0;
  while (days.has(day)) {
    streak++;
    day = addDays(day, -1);
  }
  const counts = await one(
    `SELECT (SELECT count(*)::int FROM goals WHERE user_id = $1 AND status = 'active') AS goals,
            (SELECT count(*)::int FROM journal_entries WHERE user_id = $1) AS journal,
            (SELECT count(*)::int FROM tasks WHERE user_id = $1 AND done_at IS NOT NULL) AS tasks_done,
            (SELECT created_at FROM users WHERE id = $1) AS member_since`,
    [req.user.id]
  );
  res.json({ streak, ...counts });
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
