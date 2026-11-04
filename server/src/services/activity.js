import { query } from "../db/pool.js";
import { logger } from "../logger.js";

// Records what a user did, for the admin Activity screen. Never pass content (journal text, goal titles).
// Fire-and-forget: a failed write never breaks the user's request.
export function track(userId, type, meta = {}) {
  return query("INSERT INTO activity_events (user_id, type, meta) VALUES ($1, $2, $3)", [userId, type, meta]).catch((err) =>
    logger.warn({ err: err.message, type }, "failed to record activity")
  );
}
