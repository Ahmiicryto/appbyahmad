import { Router } from "express";
import { z } from "zod";
import { one, query } from "../db/pool.js";
import { requireAdmin, requireAuth } from "../lib/auth.js";
import { badRequest, notFound } from "../lib/errors.js";
import { audit } from "../services/audit.js";
import { aiEnabled } from "../services/plan.js";
import { getSetting } from "../services/settings.js";

export const adminRouter = Router();
adminRouter.use(requireAuth, requireAdmin);

adminRouter.get("/stats", async (req, res) => {
  const totals = await one(`
    SELECT
      (SELECT count(*)::int FROM users) AS users,
      (SELECT count(*)::int FROM users WHERE created_at > now() - interval '7 days') AS new_users_7d,
      (SELECT count(*)::int FROM users WHERE last_seen_at > now() - interval '1 day') AS active_1d,
      (SELECT count(*)::int FROM users WHERE last_seen_at > now() - interval '30 days') AS active_30d,
      (SELECT count(*)::int FROM users WHERE plan = 'premium' AND (plan_expires_at IS NULL OR plan_expires_at > now())) AS premium,
      (SELECT count(*)::int FROM users WHERE status = 'suspended') AS suspended,
      (SELECT count(*)::int FROM profiles WHERE onboarded_at IS NOT NULL) AS onboarded,
      (SELECT count(*)::int FROM goals WHERE status = 'active') AS active_goals,
      (SELECT count(*)::int FROM goals WHERE status = 'completed') AS completed_goals,
      (SELECT count(*)::int FROM tasks WHERE done_at > now() - interval '7 days') AS tasks_done_7d,
      (SELECT count(*)::int FROM journal_entries WHERE created_at > now() - interval '7 days') AS journal_entries_7d,
      (SELECT coalesce(sum(input_tokens + output_tokens), 0)::bigint FROM ai_usage WHERE created_at > now() - interval '30 days') AS ai_tokens_30d,
      (SELECT count(*)::int FROM ai_usage WHERE created_at > now() - interval '30 days') AS ai_calls_30d
  `);
  const { rows: signups } = await query(`
    SELECT to_char(d, 'YYYY-MM-DD') AS day, count(u.id)::int AS count
      FROM generate_series(current_date - 29, current_date, interval '1 day') d
      LEFT JOIN users u ON u.created_at::date = d::date
     GROUP BY d ORDER BY d`);
  const { rows: themes } = await query(
    "SELECT theme, count(*)::int AS count FROM profiles WHERE onboarded_at IS NOT NULL GROUP BY theme ORDER BY theme"
  );
  const { rows: categories } = await query(
    "SELECT category, count(*)::int AS count FROM goals GROUP BY category ORDER BY count DESC"
  );
  res.json({
    totals: { ...totals, ai_tokens_30d: Number(totals.ai_tokens_30d) },
    signups,
    themes,
    categories,
    system: { aiEnabled: await aiEnabled(), aiModel: await getSetting("ai_model"), signupOpen: await getSetting("signup_open") }
  });
});

const ListQuery = z.object({
  q: z.string().trim().max(200).optional(),
  plan: z.enum(["free", "premium"]).optional(),
  status: z.enum(["active", "suspended"]).optional(),
  role: z.enum(["user", "admin"]).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25)
});

adminRouter.get("/users", async (req, res) => {
  const f = ListQuery.parse(req.query);
  const where = [];
  const params = [];
  if (f.q) where.push(`(u.email ILIKE $${params.push(`%${f.q}%`)} OR p.name ILIKE $${params.length})`);
  if (f.plan) where.push(`u.plan = $${params.push(f.plan)}`);
  if (f.status) where.push(`u.status = $${params.push(f.status)}`);
  if (f.role) where.push(`u.role = $${params.push(f.role)}`);
  const w = where.length ? `WHERE ${where.join(" AND ")}` : "";
  const { total } = await one(`SELECT count(*)::int AS total FROM users u LEFT JOIN profiles p ON p.user_id = u.id ${w}`, params);
  const { rows } = await query(
    `SELECT u.id, u.email, u.role, u.status, u.plan, u.plan_expires_at, u.created_at, u.last_seen_at,
            p.name, p.theme, p.onboarded_at IS NOT NULL AS onboarded,
            (SELECT count(*)::int FROM goals g WHERE g.user_id = u.id AND g.status = 'active') AS active_goals
       FROM users u LEFT JOIN profiles p ON p.user_id = u.id ${w}
      ORDER BY u.created_at DESC
      LIMIT $${params.push(f.pageSize)} OFFSET $${params.push((f.page - 1) * f.pageSize)}`,
    params
  );
  res.json({ users: rows, total, page: f.page, pageSize: f.pageSize });
});

async function loadUser(id) {
  if (!z.uuid().safeParse(id).success) throw notFound("User not found.");
  const user = await one(
    `SELECT u.id, u.email, u.role, u.status, u.plan, u.plan_expires_at, u.created_at, u.last_seen_at,
            p.name, p.gender, p.theme, p.occupation, p.aspiration, p.units, p.currency, p.timezone, p.onboarded_at
       FROM users u LEFT JOIN profiles p ON p.user_id = u.id WHERE u.id = $1`,
    [id]
  );
  if (!user) throw notFound("User not found.");
  return user;
}

// Journal text and body metrics are deliberately not exposed here.
adminRouter.get("/users/:id", async (req, res) => {
  const user = await loadUser(req.params.id);
  const { rows: goals } = await query(
    "SELECT id, title, category, status, progress, deadline, plan_source, created_at FROM goals WHERE user_id = $1 ORDER BY created_at DESC LIMIT 50",
    [user.id]
  );
  const activity = await one(
    `SELECT
       (SELECT count(*)::int FROM tasks WHERE user_id = $1) AS tasks_total,
       (SELECT count(*)::int FROM tasks WHERE user_id = $1 AND done_at IS NOT NULL) AS tasks_done,
       (SELECT count(*)::int FROM journal_entries WHERE user_id = $1) AS journal_entries,
       (SELECT count(*)::int FROM ai_usage WHERE user_id = $1) AS ai_calls,
       (SELECT coalesce(sum(input_tokens + output_tokens), 0)::bigint FROM ai_usage WHERE user_id = $1) AS ai_tokens`,
    [user.id]
  );
  const { rows: log } = await query(
    "SELECT id, action, details, created_at FROM audit_log WHERE target_type = 'user' AND target_id = $1 ORDER BY created_at DESC LIMIT 20",
    [user.id]
  );
  res.json({ user, goals, activity: { ...activity, ai_tokens: Number(activity.ai_tokens) }, log });
});

const UserUpdate = z
  .object({
    status: z.enum(["active", "suspended"]),
    plan: z.enum(["free", "premium"]),
    plan_expires_at: z.iso.datetime().nullable(),
    role: z.enum(["user", "admin"])
  })
  .partial()
  .strict();

adminRouter.patch("/users/:id", async (req, res) => {
  const user = await loadUser(req.params.id);
  const changes = UserUpdate.parse(req.body);
  if (user.id === req.user.id && (changes.status === "suspended" || changes.role === "user")) {
    throw badRequest("You can't suspend or demote your own account.");
  }
  const keys = Object.keys(changes);
  if (!keys.length) throw badRequest("Nothing to update.");
  await query(`UPDATE users SET ${keys.map((k, i) => `${k} = $${i + 2}`).join(", ")} WHERE id = $1`, [
    user.id,
    ...keys.map((k) => changes[k])
  ]);
  const before = Object.fromEntries(keys.map((k) => [k, user[k]]));
  await audit(req.user.id, "user.updated", "user", user.id, { before, after: changes, email: user.email });
  res.json({ user: await loadUser(user.id) });
});

adminRouter.get("/ai-usage", async (req, res) => {
  const { rows: daily } = await query(`
    SELECT to_char(d, 'YYYY-MM-DD') AS day,
           count(a.id)::int AS calls,
           coalesce(sum(a.input_tokens), 0)::int AS input_tokens,
           coalesce(sum(a.output_tokens), 0)::int AS output_tokens
      FROM generate_series(current_date - 29, current_date, interval '1 day') d
      LEFT JOIN ai_usage a ON a.created_at::date = d::date
     GROUP BY d ORDER BY d`);
  const { rows: byKind } = await query(`
    SELECT kind, model, count(*)::int AS calls, sum(input_tokens)::int AS input_tokens, sum(output_tokens)::int AS output_tokens
      FROM ai_usage WHERE created_at > now() - interval '30 days' GROUP BY kind, model ORDER BY calls DESC`);
  const { rows: topUsers } = await query(`
    SELECT u.id, u.email, u.plan, count(*)::int AS calls, sum(a.input_tokens + a.output_tokens)::int AS tokens
      FROM ai_usage a JOIN users u ON u.id = a.user_id
     WHERE a.created_at > now() - interval '30 days'
     GROUP BY u.id ORDER BY tokens DESC LIMIT 10`);
  res.json({ daily, byKind, topUsers });
});

adminRouter.get("/audit", async (req, res) => {
  const { page } = z.object({ page: z.coerce.number().int().min(1).default(1) }).parse(req.query);
  const { rows } = await query(
    `SELECT a.id, a.action, a.target_type, a.target_id, a.details, a.created_at, u.email AS actor_email
       FROM audit_log a LEFT JOIN users u ON u.id = a.actor_id
      ORDER BY a.created_at DESC LIMIT 50 OFFSET $1`,
    [(page - 1) * 50]
  );
  res.json({ entries: rows, page });
});
