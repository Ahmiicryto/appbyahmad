import { Router } from "express";
import { z } from "zod";
import { one, query } from "../db/pool.js";
import { requireAdmin, requireAuth } from "../lib/auth.js";
import { notFound } from "../lib/errors.js";
import { audit } from "../services/audit.js";

// Admin: what users do (activity_events) and what breaks (error_logs).
export const adminActivityRouter = Router();
export const adminErrorsRouter = Router();
adminActivityRouter.use(requireAuth, requireAdmin);
adminErrorsRouter.use(requireAuth, requireAdmin);

const PAGE_SIZE = 50;
const days = (def, max = 90) => z.coerce.number().int().min(1).max(max).default(def);
const like = (s) => `%${s.replace(/[\\%_]/g, "\\$&")}%`;
const isUuid = (s) => z.uuid().safeParse(s).success;

// ---------- Activity ----------

const ActivityQuery = z.object({
  type: z.string().trim().max(80).optional(),
  user: z.string().trim().max(254).optional(),
  days: days(30),
  page: z.coerce.number().int().min(1).default(1)
});

adminActivityRouter.get("/", async (req, res) => {
  const f = ActivityQuery.parse(req.query);
  const params = [f.days];
  const where = ["a.created_at > now() - $1::int * interval '1 day'"];
  if (f.type) where.push(`a.type = $${params.push(f.type)}`);
  if (f.user) {
    where.push(isUuid(f.user) ? `a.user_id = $${params.push(f.user)}` : `u.email ILIKE $${params.push(like(f.user.toLowerCase()))}`);
  }
  const w = where.join(" AND ");
  const { rows } = await query(
    `SELECT a.id, a.type, a.meta, a.created_at, a.user_id, u.email
       FROM activity_events a LEFT JOIN users u ON u.id = a.user_id
      WHERE ${w}
      ORDER BY a.created_at DESC, a.id DESC
      LIMIT $${params.push(PAGE_SIZE + 1)} OFFSET $${params.push((f.page - 1) * PAGE_SIZE)}`,
    params
  );
  const { rows: types } = await query(
    "SELECT DISTINCT type FROM activity_events WHERE created_at > now() - $1::int * interval '1 day' ORDER BY type",
    [f.days]
  );
  res.json({
    events: rows.slice(0, PAGE_SIZE),
    page: f.page,
    pageSize: PAGE_SIZE,
    hasMore: rows.length > PAGE_SIZE,
    types: types.map((t) => t.type)
  });
});

adminActivityRouter.get("/summary", async (req, res) => {
  const { days: d } = z.object({ days: days(30) }).parse(req.query);
  const win = "created_at > now() - $1::int * interval '1 day'";

  const { rows: dau } = await query(
    `SELECT to_char(d, 'YYYY-MM-DD') AS day, count(DISTINCT a.user_id)::int AS count
       FROM generate_series(current_date - ($1::int - 1), current_date, interval '1 day') d
       LEFT JOIN activity_events a ON a.created_at >= d AND a.created_at < d + interval '1 day'
      GROUP BY d ORDER BY d`,
    [d]
  );
  const { rows: byType } = await query(
    `SELECT type, count(*)::int AS count FROM activity_events WHERE ${win}
      GROUP BY type ORDER BY count DESC, type LIMIT 15`,
    [d]
  );
  const { rows: topUsers } = await query(
    `SELECT a.user_id, u.email, count(*)::int AS count, max(a.created_at) AS last_at
       FROM activity_events a JOIN users u ON u.id = a.user_id
      WHERE a.created_at > now() - $1::int * interval '1 day'
      GROUP BY a.user_id, u.email ORDER BY count DESC, last_at DESC LIMIT 10`,
    [d]
  );
  const totals = await one(
    `SELECT
       (SELECT count(*)::int FROM activity_events WHERE ${win}) AS events,
       (SELECT count(DISTINCT user_id)::int FROM activity_events WHERE created_at >= current_date) AS active_today,
       (SELECT count(DISTINCT user_id)::int FROM activity_events WHERE created_at > now() - interval '7 days') AS active_7d,
       (SELECT count(DISTINCT user_id)::int FROM activity_events WHERE created_at > now() - interval '30 days') AS active_30d,
       (SELECT count(*)::int FROM activity_events WHERE created_at > now() - interval '30 days') AS events_30d`,
    [d]
  );
  // Cohort funnel: people who signed up in the window, and how far each of them got.
  const f = await one(
    `WITH reg AS (
        SELECT DISTINCT user_id FROM activity_events
         WHERE type = 'auth.registered' AND user_id IS NOT NULL AND ${win}),
      onb AS (SELECT user_id FROM reg r WHERE EXISTS
        (SELECT 1 FROM activity_events a WHERE a.user_id = r.user_id AND a.type = 'onboarding.completed')),
      goal AS (SELECT user_id FROM onb o WHERE EXISTS
        (SELECT 1 FROM activity_events a WHERE a.user_id = o.user_id AND a.type = 'goal.created')),
      task AS (SELECT user_id FROM goal g WHERE EXISTS
        (SELECT 1 FROM activity_events a WHERE a.user_id = g.user_id AND a.type = 'task.completed'))
     SELECT (SELECT count(*)::int FROM reg) AS registered, (SELECT count(*)::int FROM onb) AS onboarded,
            (SELECT count(*)::int FROM goal) AS goal_created, (SELECT count(*)::int FROM task) AS task_completed`,
    [d]
  );
  const funnel = [
    { step: "auth.registered", label: "Signed up", count: f.registered },
    { step: "onboarding.completed", label: "Finished onboarding", count: f.onboarded },
    { step: "goal.created", label: "Created a goal", count: f.goal_created },
    { step: "task.completed", label: "Completed a task", count: f.task_completed }
  ].map((s) => ({ ...s, pct: f.registered ? Math.round((100 * s.count) / f.registered) : 0 }));

  res.json({ days: d, totals, dau, byType, topUsers, funnel });
});

adminActivityRouter.get("/user/:id", async (req, res) => {
  if (!isUuid(req.params.id)) throw notFound("User not found.");
  const { rows } = await query(
    "SELECT id, type, meta, created_at FROM activity_events WHERE user_id = $1 ORDER BY created_at DESC, id DESC LIMIT 100",
    [req.params.id]
  );
  res.json({ events: rows });
});

// ---------- Errors ----------

const ErrorsQuery = z.object({
  source: z.enum(["server", "app", "admin"]).optional(),
  status: z.enum(["open", "resolved", "all"]).default("open"),
  q: z.string().trim().max(200).optional(),
  days: days(30, 365)
});

const FP = /^[0-9a-f]{16}$/;

adminErrorsRouter.get("/summary", async (req, res) => {
  const { rows: perDay } = await query(
    `SELECT to_char(d, 'YYYY-MM-DD') AS day, count(e.id)::int AS count
       FROM generate_series(current_date - 29, current_date, interval '1 day') d
       LEFT JOIN error_logs e ON e.created_at >= d AND e.created_at < d + interval '1 day'
      GROUP BY d ORDER BY d`
  );
  const totals = await one(
    `SELECT
       (SELECT count(DISTINCT fingerprint)::int FROM error_logs WHERE resolved_at IS NULL) AS open_groups,
       (SELECT count(*)::int FROM error_logs WHERE created_at > now() - interval '1 day') AS errors_24h,
       (SELECT count(*)::int FROM error_logs WHERE created_at > now() - interval '30 days') AS errors_30d`
  );
  res.json({ ...totals, perDay });
});

adminErrorsRouter.get("/", async (req, res) => {
  const f = ErrorsQuery.parse(req.query);
  const params = [f.days];
  const where = ["created_at > now() - $1::int * interval '1 day'"];
  if (f.source) where.push(`source = $${params.push(f.source)}`);
  if (f.q) where.push(`(message ILIKE $${params.push(like(f.q))} OR path ILIKE $${params.length})`);
  const having =
    f.status === "open" ? "HAVING bool_or(resolved_at IS NULL)" : f.status === "resolved" ? "HAVING bool_and(resolved_at IS NOT NULL)" : "";
  const { rows } = await query(
    `SELECT fingerprint,
            (array_agg(message ORDER BY created_at DESC))[1] AS message,
            (array_agg(source ORDER BY created_at DESC))[1] AS source,
            (array_agg(level ORDER BY created_at DESC))[1] AS level,
            (array_agg(path ORDER BY created_at DESC))[1] AS path,
            count(*)::int AS count,
            count(DISTINCT user_id)::int AS users,
            min(created_at) AS first_seen,
            max(created_at) AS last_seen,
            bool_and(resolved_at IS NOT NULL) AS resolved
       FROM error_logs WHERE ${where.join(" AND ")}
      GROUP BY fingerprint ${having}
      ORDER BY max(created_at) DESC LIMIT 200`,
    params
  );
  res.json({ groups: rows });
});

adminErrorsRouter.get("/:fingerprint", async (req, res) => {
  const fp = req.params.fingerprint;
  if (!FP.test(fp)) throw notFound("Error not found.");
  const group = await one(
    `SELECT fingerprint, (array_agg(message ORDER BY created_at DESC))[1] AS message,
            (array_agg(source ORDER BY created_at DESC))[1] AS source,
            count(*)::int AS count, count(DISTINCT user_id)::int AS users,
            min(created_at) AS first_seen, max(created_at) AS last_seen,
            bool_and(resolved_at IS NOT NULL) AS resolved, max(resolved_at) AS resolved_at
       FROM error_logs WHERE fingerprint = $1 GROUP BY fingerprint`,
    [fp]
  );
  if (!group) throw notFound("Error not found.");
  const { rows: occurrences } = await query(
    `SELECT e.id, e.level, e.message, e.stack, e.path, e.meta, e.user_id, u.email, e.resolved_at, e.created_at
       FROM error_logs e LEFT JOIN users u ON u.id = e.user_id
      WHERE e.fingerprint = $1 ORDER BY e.created_at DESC, e.id DESC LIMIT 50`,
    [fp]
  );
  res.json({ group, occurrences });
});

async function setResolved(req, res, resolved) {
  const fp = req.params.fingerprint;
  if (!FP.test(fp)) throw notFound("Error not found.");
  const r = await query(
    resolved
      ? "UPDATE error_logs SET resolved_at = now() WHERE fingerprint = $1 AND resolved_at IS NULL"
      : "UPDATE error_logs SET resolved_at = NULL WHERE fingerprint = $1 AND resolved_at IS NOT NULL",
    [fp]
  );
  if (!r.rowCount) {
    const exists = await one("SELECT 1 FROM error_logs WHERE fingerprint = $1 LIMIT 1", [fp]);
    if (!exists) throw notFound("Error not found.");
  }
  await audit(req.user.id, resolved ? "error.resolved" : "error.reopened", "error", fp, { rows: r.rowCount });
  res.json({ fingerprint: fp, resolved });
}

adminErrorsRouter.post("/:fingerprint/resolve", (req, res) => setResolved(req, res, true));
adminErrorsRouter.post("/:fingerprint/reopen", (req, res) => setResolved(req, res, false));
