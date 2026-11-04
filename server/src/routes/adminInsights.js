import { Router } from "express";
import { z } from "zod";
import { one, query } from "../db/pool.js";
import { requireAdmin, requireAuth } from "../lib/auth.js";

export const adminInsightsRouter = Router();
adminInsightsRouter.use(requireAuth, requireAdmin);

const Query = z.object({ days: z.coerce.number().int().min(7).max(365).default(30) });
const PAID = ["succeeded", "paid"];

adminInsightsRouter.get("/", async (req, res) => {
  const { days } = Query.parse(req.query);
  const series = `generate_series(current_date - ($1::int - 1), current_date, interval '1 day') d`;

  const { n: events } = await one(
    "SELECT count(*)::int AS n FROM activity_events WHERE user_id IS NOT NULL AND created_at >= current_date - ($1::int - 1)",
    [days]
  );
  // Before activity tracking has data, fall back to "last seen" (only counts each person's latest day).
  const dauSource = events > 0 ? "events" : "last_seen";
  const { rows: dau } =
    dauSource === "events"
      ? await query(
          `SELECT to_char(d, 'YYYY-MM-DD') AS day, count(DISTINCT e.user_id)::int AS count
             FROM ${series}
             LEFT JOIN activity_events e ON e.created_at >= d AND e.created_at < d + interval '1 day' AND e.user_id IS NOT NULL
            GROUP BY d ORDER BY d`,
          [days]
        )
      : await query(
          `SELECT to_char(d, 'YYYY-MM-DD') AS day, count(u.id)::int AS count
             FROM ${series}
             LEFT JOIN users u ON u.last_seen_at >= d AND u.last_seen_at < d + interval '1 day'
            GROUP BY d ORDER BY d`,
          [days]
        );

  const { rows: signups } = await query(
    `SELECT to_char(d, 'YYYY-MM-DD') AS day, count(u.id)::int AS count
       FROM ${series}
       LEFT JOIN users u ON u.created_at >= d AND u.created_at < d + interval '1 day'
      GROUP BY d ORDER BY d`,
    [days]
  );

  const { rows: revenue } = await query(
    `SELECT to_char(d, 'YYYY-MM-DD') AS day, coalesce(sum(p.amount_cents), 0)::int AS cents
       FROM ${series}
       LEFT JOIN payments p ON p.created_at >= d AND p.created_at < d + interval '1 day' AND p.status = ANY($2)
      GROUP BY d ORDER BY d`,
    [days, PAID]
  );

  // Of people who signed up 8–37 days ago, how many came back in their days 7–30.
  const retention = await one(`
    SELECT count(*)::int AS cohort,
           count(*) FILTER (WHERE EXISTS (
             SELECT 1 FROM activity_events e
              WHERE e.user_id = u.id
                AND e.created_at >= u.created_at + interval '7 days'
                AND e.created_at < u.created_at + interval '31 days'))::int AS retained
      FROM users u
     WHERE u.role = 'user'
       AND u.created_at >= now() - interval '37 days'
       AND u.created_at < now() - interval '8 days'`);

  const totals = await one(
    `SELECT
       (SELECT coalesce(round(sum(
          CASE WHEN coalesce(p.interval, 'month') = 'year' THEN coalesce(s.amount_cents, p.price_cents, 0) / 12.0
               ELSE coalesce(s.amount_cents, p.price_cents, 0) END)), 0)::int
          FROM subscriptions s LEFT JOIN plans p ON p.id = s.plan_id
         WHERE s.status IN ('active', 'trialing')) AS mrr_cents,
       (SELECT count(*)::int FROM users WHERE role = 'user') AS users,
       (SELECT count(*)::int FROM users WHERE role = 'user' AND plan = 'premium' AND (plan_expires_at IS NULL OR plan_expires_at > now())) AS premium,
       (SELECT count(*)::int FROM notifications WHERE created_at > now() - interval '30 days') AS notifications_30d,
       (SELECT count(DISTINCT fingerprint)::int FROM error_logs WHERE resolved_at IS NULL AND created_at > now() - interval '7 days') AS open_errors,
       (SELECT count(*)::int FROM goals WHERE status = 'completed' AND updated_at > now() - interval '30 days') AS goals_completed_30d,
       (SELECT coalesce(sum(amount_cents), 0)::bigint FROM payments WHERE status = ANY($1) AND created_at >= current_date - ($2::int - 1)) AS revenue_cents`,
    [PAID, days]
  );

  const pct = (a, b) => (b ? Math.round((a / b) * 1000) / 10 : 0);
  res.json({
    days,
    dau,
    dauSource,
    signups,
    revenue,
    revenueCents: Number(totals.revenue_cents),
    retention: { cohort: retention.cohort, retained: retention.retained, pct: pct(retention.retained, retention.cohort) },
    mrrCents: totals.mrr_cents,
    premiumConversion: pct(totals.premium, totals.users),
    notificationsSent30d: totals.notifications_30d,
    openErrors: totals.open_errors,
    goalsCompleted30d: totals.goals_completed_30d
  });
});
