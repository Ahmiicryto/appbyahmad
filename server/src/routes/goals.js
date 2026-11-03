import { Router } from "express";
import { z } from "zod";
import { config } from "../config.js";
import { one, query, tx } from "../db/pool.js";
import { requireAuth } from "../lib/auth.js";
import { isYmd, todayIn } from "../lib/dates.js";
import { badRequest, notFound, paymentRequired } from "../lib/errors.js";
import { aiEnabled, generatePlan, normalizePlan, templatePlan } from "../services/plan.js";
import { getProfile } from "./profile.js";

export const goalsRouter = Router();
goalsRouter.use(requireAuth);

const CATEGORIES = ["business", "fitness", "money", "career", "learning", "personal"];
const date = z.string().refine(isYmd, "Use YYYY-MM-DD.");

const GoalCreate = z.object({
  title: z.string().trim().min(3, "Describe your goal in a few words.").max(200),
  current_situation: z.string().trim().max(500).optional(),
  target: z.string().trim().max(200).optional(),
  reason: z.string().trim().max(500).optional(),
  deadline: date.optional(),
  category: z.enum(CATEGORIES).optional()
});

const GoalUpdate = z
  .object({
    title: z.string().trim().min(3).max(200),
    target: z.string().trim().max(200).nullable(),
    reason: z.string().trim().max(500).nullable(),
    deadline: date.nullable(),
    status: z.enum(["active", "paused", "completed", "cancelled"]),
    progress: z.number().int().min(0).max(100),
    notes: z.string().max(5000).nullable(),
    category: z.enum(CATEGORIES)
  })
  .partial()
  .strict();

async function loadGoal(userId, id) {
  if (!z.uuid().safeParse(id).success) throw notFound("Goal not found.");
  const goal = await one("SELECT * FROM goals WHERE id = $1 AND user_id = $2", [id, userId]);
  if (!goal) throw notFound("Goal not found.");
  return goal;
}

goalsRouter.get("/", async (req, res) => {
  const { rows } = await query(
    `SELECT g.*,
            (SELECT count(*)::int FROM milestones m WHERE m.goal_id = g.id) AS milestone_count,
            (SELECT count(*)::int FROM milestones m WHERE m.goal_id = g.id AND m.status = 'done') AS milestones_done
       FROM goals g WHERE g.user_id = $1
      ORDER BY (g.status = 'active') DESC, g.created_at DESC`,
    [req.user.id]
  );
  res.json({ goals: rows });
});

goalsRouter.post("/", async (req, res) => {
  const input = GoalCreate.parse(req.body);
  const userId = req.user.id;

  if (!req.user.isPremium) {
    const { n } = await one("SELECT count(*)::int AS n FROM goals WHERE user_id = $1 AND status = 'active'", [userId]);
    if (n >= config.FREE_ACTIVE_GOALS) {
      throw paymentRequired(
        `The free plan includes ${config.FREE_ACTIVE_GOALS} active goal. Upgrade to Premium for unlimited goals, or pause a goal first.`,
        "goal_limit"
      );
    }
  }
  if (input.deadline && input.deadline < todayIn("UTC")) throw badRequest("The deadline is in the past.");

  const profile = await getProfile(userId);
  const today = todayIn(profile?.timezone);
  let useAi = aiEnabled();
  if (useAi && !req.user.isPremium) {
    const { n } = await one(
      "SELECT count(*)::int AS n FROM ai_usage WHERE user_id = $1 AND kind = 'goal_plan' AND created_at > now() - interval '30 days'",
      [userId]
    );
    useAi = n < config.FREE_AI_PLANS_PER_MONTH;
  }
  const plan = useAi
    ? await generatePlan({ userId, goal: input, profile, today })
    : { ...normalizePlan(templatePlan(input), input, today), source: "template" };

  const goal = await tx(async (c) => {
    const g = (
      await c.query(
        `INSERT INTO goals (user_id, title, category, current_situation, target, reason, deadline, plan_summary, plan_source)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
        [
          userId,
          input.title,
          input.category || plan.category,
          input.current_situation ?? null,
          input.target ?? null,
          input.reason ?? null,
          input.deadline ?? null,
          plan.summary,
          plan.source
        ]
      )
    ).rows[0];
    for (const [i, m] of plan.milestones.entries()) {
      await c.query("INSERT INTO milestones (goal_id, position, title, due_date, status) VALUES ($1, $2, $3, $4, $5)", [
        g.id,
        i,
        m.title,
        m.due_date,
        i === 0 ? "in_progress" : "upcoming"
      ]);
    }
    for (const t of plan.tasks) {
      await c.query("INSERT INTO tasks (user_id, goal_id, source, title, due_date) VALUES ($1, $2, 'goal', $3, $4)", [
        userId,
        g.id,
        t.title,
        t.due_date
      ]);
    }
    return g;
  });
  res.status(201).json(await goalDetail(userId, goal.id));
});

async function goalDetail(userId, id) {
  const goal = await loadGoal(userId, id);
  const milestones = (await query("SELECT * FROM milestones WHERE goal_id = $1 ORDER BY position", [id])).rows;
  const tasks = (
    await query("SELECT * FROM tasks WHERE goal_id = $1 ORDER BY due_date, created_at LIMIT 50", [id])
  ).rows;
  return { goal, milestones, tasks };
}

goalsRouter.get("/:id", async (req, res) => {
  res.json(await goalDetail(req.user.id, req.params.id));
});

goalsRouter.patch("/:id", async (req, res) => {
  const goal = await loadGoal(req.user.id, req.params.id);
  const fields = GoalUpdate.parse(req.body);
  if (fields.status === "active" && goal.status !== "active" && !req.user.isPremium) {
    const { n } = await one("SELECT count(*)::int AS n FROM goals WHERE user_id = $1 AND status = 'active'", [req.user.id]);
    if (n >= config.FREE_ACTIVE_GOALS) throw paymentRequired("Pause your other goal first, or upgrade to Premium.", "goal_limit");
  }
  if (fields.status === "completed") fields.progress = 100;
  const keys = Object.keys(fields);
  if (keys.length) {
    await query(
      `UPDATE goals SET ${keys.map((k, i) => `${k} = $${i + 2}`).join(", ")}, updated_at = now() WHERE id = $1`,
      [goal.id, ...keys.map((k) => fields[k])]
    );
  }
  res.json(await goalDetail(req.user.id, goal.id));
});

goalsRouter.patch("/:id/milestones/:mid", async (req, res) => {
  const goal = await loadGoal(req.user.id, req.params.id);
  const { status } = z.object({ status: z.enum(["upcoming", "in_progress", "done"]) }).parse(req.body);
  if (!z.uuid().safeParse(req.params.mid).success) throw notFound("Milestone not found.");
  const m = await one("UPDATE milestones SET status = $3 WHERE id = $1 AND goal_id = $2 RETURNING id", [
    req.params.mid,
    goal.id,
    status
  ]);
  if (!m) throw notFound("Milestone not found.");
  // Progress follows milestones unless the user sets it by hand.
  await query(
    `UPDATE goals SET progress = (
       SELECT coalesce(round(100.0 * count(*) FILTER (WHERE status = 'done') / nullif(count(*), 0)), 0)
         FROM milestones WHERE goal_id = $1), updated_at = now()
     WHERE id = $1`,
    [goal.id]
  );
  res.json(await goalDetail(req.user.id, goal.id));
});

goalsRouter.delete("/:id", async (req, res) => {
  const goal = await loadGoal(req.user.id, req.params.id);
  await query("DELETE FROM goals WHERE id = $1", [goal.id]);
  res.status(204).end();
});
