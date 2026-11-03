import { one } from "../db/pool.js";
import { addDays } from "../lib/dates.js";

// Life Score (0-1000): progress and consistency only, never a judgement of the person.
//   Consistency = share of tasks done over the last 7 days (incl. today)
//   Goals       = average progress of active goals
export async function lifeScore(userId, today) {
  const from = addDays(today, -6);
  const t = await one(
    `SELECT count(*)::int AS total, count(done_at)::int AS done
       FROM tasks WHERE user_id = $1 AND due_date BETWEEN $2 AND $3`,
    [userId, from, today]
  );
  const g = await one(
    "SELECT coalesce(avg(progress), 0)::float AS avg FROM goals WHERE user_id = $1 AND status = 'active'",
    [userId]
  );
  const consistency = t.total ? Math.round((t.done / t.total) * 100) : 0;
  const goals = Math.round(g.avg);
  const score = Math.round(consistency * 5 + goals * 5);
  return { score, max: 1000, parts: { consistency, goals } };
}
