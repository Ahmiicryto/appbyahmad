import crypto from "node:crypto";
import { query } from "../db/pool.js";
import { logger } from "../logger.js";

// Groups repeats of the same error: message with numbers/ids stripped + first stack frame.
export function fingerprint(source, message, stack) {
  const msg = String(message).replace(/[0-9a-f]{8}-[0-9a-f-]{27,}/gi, ":id").replace(/\d+/g, ":n").slice(0, 300);
  const frame = (stack || "").split("\n").find((l) => l.trim().startsWith("at ")) || "";
  return crypto.createHash("sha1").update(`${source}|${msg}|${frame.trim()}`).digest("hex").slice(0, 16);
}

// One crash loop (or someone flooding the report endpoint) can't fill the table:
// at most this many rows per distinct error per hour. The count shown in admin stops there too.
export const MAX_PER_FINGERPRINT_PER_HOUR = 50;

// Saves an error for the admin Error logs screen. Never throws.
export function logError({ source = "server", level = "error", message, stack = null, path = null, userId = null, meta = {} }) {
  const msg = String(message || "Unknown error").slice(0, 2000);
  const fp = fingerprint(source, msg, stack);
  return query(
    `INSERT INTO error_logs (source, level, message, stack, path, user_id, meta, fingerprint)
     SELECT $1, $2, $3, $4, $5, $6, $7, $8
      WHERE (SELECT count(*) FROM error_logs WHERE fingerprint = $8 AND created_at > now() - interval '1 hour') < $9`,
    [source, level, msg, stack ? String(stack).slice(0, 8000) : null, path, userId, meta, fp, MAX_PER_FINGERPRINT_PER_HOUR]
  ).catch((err) => logger.warn({ err: err.message }, "failed to record error log"));
}
