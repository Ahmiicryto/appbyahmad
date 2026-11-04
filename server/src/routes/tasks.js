import { Router } from "express";
import { z } from "zod";
import { one, query } from "../db/pool.js";
import { requireAuth } from "../lib/auth.js";
import { isYmd, todayIn } from "../lib/dates.js";
import { badRequest, notFound } from "../lib/errors.js";
import { lifeScore } from "../services/lifeScore.js";
import { getProfile } from "./profile.js";
import { track } from "../services/activity.js";

export const tasksRouter = Router();
tasksRouter.use(requireAuth);

const date = z.string().refine(isYmd, "Use YYYY-MM-DD.");

// Daily Command Center: everything due today from every module, plus the Life Score.
tasksRouter.get("/today", async (req, res) => {
  const profile = await getProfile(req.user.id);
  const day = req.query.date ?? todayIn(profile?.timezone);
  if (!isYmd(day)) throw badRequest("date must be YYYY-MM-DD.");
  const { rows: tasks } = await query(
    `SELECT t.*, g.title AS goal_title, g.category AS goal_category
       FROM tasks t LEFT JOIN goals g ON g.id = t.goal_id
      WHERE t.user_id = $1 AND t.due_date = $2 AND (g.id IS NULL OR g.status = 'active')
      ORDER BY t.due_time NULLS LAST, t.created_at`,
    [req.user.id, day]
  );
  const { rows: goals } = await query(
    "SELECT id, title, category, progress FROM goals WHERE user_id = $1 AND status = 'active' ORDER BY created_at",
    [req.user.id]
  );
  res.json({
    date: day,
    name: profile?.name ?? null,
    tasks,
    done: tasks.filter((t) => t.done_at).length,
    goals,
    lifeScore: await lifeScore(req.user.id, day)
  });
});

const TaskCreate = z.object({
  title: z.string().trim().min(1).max(200),
  due_date: date.optional(),
  due_time: z.string().regex(/^\d{2}:\d{2}$/, "Use HH:MM.").optional(),
  source: z.enum(["fitness", "money", "career", "custom"]).default("custom"),
  goal_id: z.uuid().optional()
});

tasksRouter.post("/tasks", async (req, res) => {
  const input = TaskCreate.parse(req.body);
  if (input.goal_id) {
    const g = await one("SELECT 1 FROM goals WHERE id = $1 AND user_id = $2", [input.goal_id, req.user.id]);
    if (!g) throw notFound("Goal not found.");
  }
  const profile = await getProfile(req.user.id);
  const task = await one(
    `INSERT INTO tasks (user_id, goal_id, source, title, due_date, due_time)
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
    [
      req.user.id,
      input.goal_id ?? null,
      input.goal_id ? "goal" : input.source,
      input.title,
      input.due_date ?? todayIn(profile?.timezone),
      input.due_time ?? null
    ]
  );
  track(req.user.id, "task.created", { source: task.source });
  res.status(201).json({ task });
});

tasksRouter.patch("/tasks/:id", async (req, res) => {
  if (!z.uuid().safeParse(req.params.id).success) throw notFound("Task not found.");
  const input = z
    .object({ done: z.boolean(), title: z.string().trim().min(1).max(200), due_date: date })
    .partial()
    .strict()
    .parse(req.body);
  const sets = [];
  const params = [req.params.id, req.user.id];
  if (input.done !== undefined) sets.push(input.done ? "done_at = coalesce(done_at, now())" : "done_at = NULL");
  if (input.title !== undefined) sets.push(`title = $${params.push(input.title)}`);
  if (input.due_date !== undefined) sets.push(`due_date = $${params.push(input.due_date)}`);
  if (!sets.length) throw badRequest("Nothing to update.");
  const task = await one(`UPDATE tasks SET ${sets.join(", ")} WHERE id = $1 AND user_id = $2 RETURNING *`, params);
  if (!task) throw notFound("Task not found.");
  if (input.done === true) track(req.user.id, "task.completed", { source: task.source });
  res.json({ task });
});

tasksRouter.delete("/tasks/:id", async (req, res) => {
  if (!z.uuid().safeParse(req.params.id).success) throw notFound("Task not found.");
  const r = await query("DELETE FROM tasks WHERE id = $1 AND user_id = $2", [req.params.id, req.user.id]);
  if (!r.rowCount) throw notFound("Task not found.");
  res.status(204).end();
});
