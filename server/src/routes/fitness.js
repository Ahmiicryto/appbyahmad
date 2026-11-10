import { Router } from "express";
import { z } from "zod";
import { one, query } from "../db/pool.js";
import { requireAuth } from "../lib/auth.js";
import { addDays, todayIn } from "../lib/dates.js";
import { notFound } from "../lib/errors.js";
import { track } from "../services/activity.js";
import { EXERCISES, EXERCISE_IDS, estimateCalories } from "../services/exercises.js";

export const fitnessRouter = Router();
fitnessRouter.use(requireAuth);

const today = async (userId) => todayIn((await one("SELECT timezone FROM profiles WHERE user_id = $1", [userId]))?.timezone || "UTC");

fitnessRouter.get("/exercises", (req, res) => res.json({ exercises: EXERCISES }));

// Streak, this week and all-time totals for the Fitness screen.
fitnessRouter.get("/summary", async (req, res) => {
  const day = await today(req.user.id);
  const weekStart = addDays(day, -((new Date(`${day}T12:00:00Z`).getUTCDay() + 6) % 7));
  const { rows } = await query("SELECT DISTINCT day::text AS d FROM workout_logs WHERE user_id = $1 AND day > $2::date - 400", [req.user.id, day]);
  const days = new Set(rows.map((r) => r.d));
  let d = days.has(day) ? day : addDays(day, -1);
  let streak = 0;
  while (days.has(d)) {
    streak++;
    d = addDays(d, -1);
  }
  const week = await one(
    `SELECT count(*)::int AS workouts, coalesce(sum(duration_sec), 0)::int AS seconds, coalesce(sum(calories), 0)::int AS calories
       FROM workout_logs WHERE user_id = $1 AND day >= $2`,
    [req.user.id, weekStart]
  );
  const total = await one("SELECT count(*)::int AS workouts, coalesce(sum(duration_sec), 0)::int AS seconds FROM workout_logs WHERE user_id = $1", [req.user.id]);
  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const x = addDays(weekStart, i);
    return { day: x, done: days.has(x), today: x === day };
  });
  res.json({ streak, week: { ...week, minutes: Math.round(week.seconds / 60) }, total: { ...total, minutes: Math.round(total.seconds / 60) }, weekDays });
});

fitnessRouter.get("/logs", async (req, res) => {
  const { rows } = await query(
    "SELECT id, title, duration_sec, calories, exercises, day::text AS day, created_at FROM workout_logs WHERE user_id = $1 ORDER BY created_at DESC LIMIT 50",
    [req.user.id]
  );
  res.json({ logs: rows });
});

const LogBody = z
  .object({
    title: z.string().trim().min(1).max(80),
    duration_sec: z.number().int().min(10).max(6 * 3600),
    exercises: z
      .array(
        z.object({
          exercise_id: z.enum(EXERCISE_IDS),
          reps: z.number().int().min(1).max(500).nullable().optional(),
          seconds: z.number().int().min(1).max(3600).nullable().optional()
        })
      )
      .min(1)
      .max(80)
  })
  .strict();

// Saving a workout also ticks a done "Workout" task for today, so it counts toward the Life Score.
fitnessRouter.post("/logs", async (req, res) => {
  const body = LogBody.parse(req.body ?? {});
  const day = await today(req.user.id);
  const p = await one("SELECT weight_kg FROM profiles WHERE user_id = $1", [req.user.id]);
  const calories = estimateCalories(body.exercises, p?.weight_kg ? Number(p.weight_kg) : null);
  const log = await one(
    `INSERT INTO workout_logs (user_id, title, duration_sec, calories, exercises, day) VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING id, title, duration_sec, calories, exercises, day::text AS day, created_at`,
    [req.user.id, body.title, body.duration_sec, calories, JSON.stringify(body.exercises), day]
  );
  await query(
    "INSERT INTO tasks (user_id, source, title, due_date, done_at) VALUES ($1, 'fitness', $2, $3, now())",
    [req.user.id, `Workout: ${body.title}`.slice(0, 200), day]
  );
  track(req.user.id, "workout.completed", { minutes: Math.round(body.duration_sec / 60) });
  res.status(201).json({ log });
});

fitnessRouter.delete("/logs/:id", async (req, res) => {
  const r = await one("DELETE FROM workout_logs WHERE id::text = $1 AND user_id = $2 RETURNING id", [req.params.id, req.user.id]);
  if (!r) throw notFound("Workout not found.");
  res.status(204).end();
});
