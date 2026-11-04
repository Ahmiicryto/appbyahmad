import { z } from "zod";
import { query } from "../db/pool.js";
import { logger } from "../logger.js";
import { logError } from "./errorLog.js";
import { sendPush } from "./push.js";

// Who an admin campaign goes to. Suspended users are always excluded.
export const Audience = z.discriminatedUnion("type", [
  z.object({ type: z.literal("all") }),
  z.object({ type: z.literal("plan"), plan: z.enum(["free", "premium"]) }),
  z.object({ type: z.literal("user"), email: z.string().trim().email().max(320) }),
  z.object({ type: z.literal("inactive"), days: z.coerce.number().int().min(1).max(365) }),
  z.object({ type: z.literal("theme"), theme: z.enum(["male", "female", "neutral"]) })
]);

// SQL that selects the audience: `SELECT u.id FROM users u LEFT JOIN profiles p ... WHERE ...`.
export function audienceQuery(input) {
  const a = Audience.parse(input);
  const where = ["u.status <> 'suspended'"];
  const params = [];
  switch (a.type) {
    case "plan":
      // "premium" means currently premium (not expired); everyone else counts as free.
      if (a.plan === "premium") where.push("u.plan = 'premium' AND (u.plan_expires_at IS NULL OR u.plan_expires_at > now())");
      else where.push("NOT (u.plan = 'premium' AND (u.plan_expires_at IS NULL OR u.plan_expires_at > now()))");
      break;
    case "user":
      where.push(`u.email = $${params.push(a.email)}`);
      break;
    case "inactive":
      where.push(`(u.last_seen_at IS NULL OR u.last_seen_at < now() - make_interval(days => $${params.push(a.days)}::int))`);
      break;
    case "theme":
      where.push(`coalesce(p.theme, 'neutral') = $${params.push(a.theme)}`);
      break;
  }
  return {
    audience: a,
    sql: `SELECT u.id FROM users u LEFT JOIN profiles p ON p.user_id = u.id WHERE ${where.join(" AND ")}`,
    params
  };
}

export async function resolveAudience(audience) {
  const { sql, params } = audienceQuery(audience);
  const { rows } = await query(sql, params);
  return rows.map((r) => r.id);
}

const prefFor = (kind) => (kind === "announcement" ? "announcements" : kind === "reminder" ? "reminders" : null);

/**
 * Puts a notification in each user's inbox (one INSERT ... SELECT) and, when push is on, sends it to their devices.
 * Never throws. Returns {recipients, push: {sent, failed}}.
 */
export async function notifyUsers(userIds, { title, body, data = {}, kind = "message", campaignId = null }, { push = true } = {}) {
  const out = { recipients: 0, push: { sent: 0, failed: 0 } };
  const ids = [...new Set((userIds || []).filter(Boolean))];
  if (!ids.length) return out;
  try {
    const r = await query(
      `INSERT INTO notifications (user_id, campaign_id, kind, title, body, data)
       SELECT u.id, $2, $3, $4, $5, $6 FROM users u WHERE u.id = ANY($1::uuid[])`,
      [ids, campaignId, kind, title, body, data]
    );
    out.recipients = r.rowCount;
  } catch (err) {
    logger.warn({ err: err.message }, "notify insert failed");
    logError({ message: err.message, stack: err.stack, path: "notify.inbox", meta: { kind, campaignId } });
    return out;
  }
  if (push) out.push = await sendPush(ids, { title, body, data }, { pref: prefFor(kind) });
  return out;
}

export const notifyUser = (userId, msg, opts) => notifyUsers([userId], msg, opts);
