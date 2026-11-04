import { query } from "../db/pool.js";
import { logger } from "../logger.js";

// How long monitoring data is kept. Runs at startup and twice a day.
export const RETENTION = { errorDays: 30, activityDays: 365, webhookDays: 90 };

export async function pruneOldData(r = RETENTION) {
  const errors = await query("DELETE FROM error_logs WHERE created_at < now() - make_interval(days => $1)", [r.errorDays]);
  const activity = await query("DELETE FROM activity_events WHERE created_at < now() - make_interval(days => $1)", [r.activityDays]);
  const webhooks = await query("DELETE FROM webhook_events WHERE received_at < now() - make_interval(days => $1)", [r.webhookDays]);
  return { errors: errors.rowCount, activity: activity.rowCount, webhooks: webhooks.rowCount };
}

export function scheduleRetention(everyMs = 12 * 60 * 60 * 1000) {
  const run = () =>
    pruneOldData()
      .then((removed) => logger.info({ removed }, "pruned old monitoring data"))
      .catch((err) => logger.warn({ err: err.message }, "pruning old monitoring data failed"));
  run();
  setInterval(run, everyMs).unref();
}
