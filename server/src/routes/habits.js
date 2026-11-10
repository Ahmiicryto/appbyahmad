import { Router } from "express";
import { z } from "zod";
import { one, query } from "../db/pool.js";
import { requireAuth } from "../lib/auth.js";
import { addDays, isYmd, todayIn } from "../lib/dates.js";
import { badRequest, notFound } from "../lib/errors.js";
import { track } from "../services/activity.js";

export const habitsRouter = Router();
habitsRouter.use(requireAuth);

const ICONS = ["check", "water", "book", "dumbbell", "heart", "leaf", "moon", "sun", "wallet", "target", "sparkles", "clock", "phone", "chat", "flame"];
const TONES = ["violet", "blue", "green", "amber", "pink", "indigo", "lime", "cyan", "orange", "red"];
const MAX_HABITS = 20;

const today = async (userId) => todayIn((await one("SELECT timezone FROM profiles WHERE user_id = $1", [userId]))?.timezone || "UTC");

async function list(userId) {
  const day = await today(userId);
  const { rows: habits } = await query("SELECT id, title, icon, tone, position, created_at FROM habits WHERE user_id = $1 AND NOT archived ORDER BY position, created_at", [userId]);
  if (!habits.length) return { day, habits: [] };
  const { rows: checks } = await query(
    "SELECT habit_id, day::text AS d FROM habit_checks WHERE habit_id = ANY($1) AND day > $2::date - 400",
    [habits.map((h) => h.id), day]
  );
  const byHabit = new Map(habits.map((h) => [h.id, new Set()]));
  for (const c of checks) byHabit.get(c.habit_id)?.add(c.d);
  return {
    day,
    habits: habits.map((h) => {
      const set = byHabit.get(h.id);
      let d = set.has(day) ? day : addDays(day, -1);
      let streak = 0;
      while (set.has(d)) {
        streak++;
        d = addDays(d, -1);
      }
      const last7 = Array.from({ length: 7 }, (_, i) => set.has(addDays(day, i - 6)));
      return { ...h, done_today: set.has(day), streak, last7, rate30: Math.round((Array.from({ length: 30 }, (_, i) => set.has(addDays(day, -i))).filter(Boolean).length / 30) * 100) };
    })
  };
}

habitsRouter.get("/", async (req, res) => res.json(await list(req.user.id)));

const HabitBody = z.object({
  title: z.string().trim().min(1, "Give it a name.").max(60),
  icon: z.enum(ICONS).default("check"),
  tone: z.enum(TONES).default("violet")
}).strict();

habitsRouter.post("/", async (req, res) => {
  const b = HabitBody.parse(req.body ?? {});
  const { n } = await one("SELECT count(*)::int AS n FROM habits WHERE user_id = $1 AND NOT archived", [req.user.id]);
  if (n >= MAX_HABITS) throw badRequest(`You can track up to ${MAX_HABITS} habits. Archive one first.`, "habit_limit");
  await query("INSERT INTO habits (user_id, title, icon, tone, position) VALUES ($1, $2, $3, $4, $5)", [req.user.id, b.title, b.icon, b.tone, n]);
  track(req.user.id, "habit.created");
  res.status(201).json(await list(req.user.id));
});

habitsRouter.patch("/:id", async (req, res) => {
  const b = HabitBody.partial().extend({ archived: z.boolean().optional() }).strict().parse(req.body ?? {});
  const keys = Object.keys(b);
  if (!keys.length) throw badRequest("Nothing to change.");
  const r = await one(
    `UPDATE habits SET ${keys.map((k, i) => `${k} = $${i + 3}`).join(", ")} WHERE id::text = $1 AND user_id = $2 RETURNING id`,
    [req.params.id, req.user.id, ...keys.map((k) => b[k])]
  );
  if (!r) throw notFound("Habit not found.");
  res.json(await list(req.user.id));
});

habitsRouter.delete("/:id", async (req, res) => {
  const r = await one("DELETE FROM habits WHERE id::text = $1 AND user_id = $2 RETURNING id", [req.params.id, req.user.id]);
  if (!r) throw notFound("Habit not found.");
  res.json(await list(req.user.id));
});

// Idempotent: sending done=true twice keeps one check (safe against double taps).
habitsRouter.post("/:id/check", async (req, res) => {
  const b = z.object({ done: z.boolean(), day: z.string().refine(isYmd).optional() }).strict().parse(req.body ?? {});
  const h = await one("SELECT id FROM habits WHERE id::text = $1 AND user_id = $2", [req.params.id, req.user.id]);
  if (!h) throw notFound("Habit not found.");
  const day = b.day ?? (await today(req.user.id));
  if (b.done) {
    await query("INSERT INTO habit_checks (habit_id, day) VALUES ($1, $2) ON CONFLICT DO NOTHING", [h.id, day]);
    track(req.user.id, "habit.checked");
  } else {
    await query("DELETE FROM habit_checks WHERE habit_id = $1 AND day = $2", [h.id, day]);
  }
  res.json(await list(req.user.id));
});
