import crypto from "node:crypto";
import { query } from "../db/pool.js";
import { logger } from "../logger.js";

// Groups repeats of the same error: message with numbers/ids stripped + first stack frame.
export function fingerprint(source, message, stack) {
  const msg = String(message).replace(/[0-9a-f]{8}-[0-9a-f-]{27,}/gi, ":id").replace(/\d+/g, ":n").slice(0, 300);
  const frame = (stack || "").split("\n").find((l) => l.trim().startsWith("at ")) || "";
  return crypto.createHash("sha1").update(`${source}|${msg}|${frame.trim()}`).digest("hex").slice(0, 16);
}

// Saves an error for the admin Error logs screen. Never throws.
export function logError({ source = "server", level = "error", message, stack = null, path = null, userId = null, meta = {} }) {
  const msg = String(message || "Unknown error").slice(0, 2000);
  return query(
    `INSERT INTO error_logs (source, level, message, stack, path, user_id, meta, fingerprint)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [source, level, msg, stack ? String(stack).slice(0, 8000) : null, path, userId, meta, fingerprint(source, msg, stack)]
  ).catch((err) => logger.warn({ err: err.message }, "failed to record error log"));
}
