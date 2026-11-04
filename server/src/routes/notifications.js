import { Router } from "express";
import { z } from "zod";
import { one, query } from "../db/pool.js";
import { requireAuth } from "../lib/auth.js";
import { notFound } from "../lib/errors.js";
import { track } from "../services/activity.js";
import { EXPO_TOKEN_RE } from "../services/push.js";

export const notificationsRouter = Router();
notificationsRouter.use(requireAuth);

const DEFAULT_PREFS = { push: true, reminders: true, announcements: true };

notificationsRouter.get("/", async (req, res) => {
  const { rows } = await query(
    `SELECT id, kind, title, body, data, created_at, read_at, read_at IS NOT NULL AS read
       FROM notifications WHERE user_id = $1
      ORDER BY created_at DESC, id DESC LIMIT 50`,
    [req.user.id]
  );
  const unread = await unreadCount(req.user.id);
  res.json({ notifications: rows.map((r) => ({ ...r, id: String(r.id) })), unread });
});

async function unreadCount(userId) {
  const { count } = await one("SELECT count(*)::int AS count FROM notifications WHERE user_id = $1 AND read_at IS NULL", [userId]);
  return count;
}

notificationsRouter.get("/unread-count", async (req, res) => {
  res.json({ count: await unreadCount(req.user.id) });
});

notificationsRouter.post("/read-all", async (req, res) => {
  const r = await query("UPDATE notifications SET read_at = now() WHERE user_id = $1 AND read_at IS NULL", [req.user.id]);
  res.json({ ok: true, updated: r.rowCount });
});

const Id = z.coerce.number().int().positive();

notificationsRouter.post("/:id/read", async (req, res) => {
  const id = Id.safeParse(req.params.id);
  if (!id.success) throw notFound("Notification not found.");
  const row = await one(
    `UPDATE notifications SET read_at = coalesce(read_at, now())
      WHERE id = $1 AND user_id = $2
      RETURNING id, campaign_id, kind`,
    [id.data, req.user.id]
  );
  if (!row) throw notFound("Notification not found.");
  track(req.user.id, "notification.opened", { kind: row.kind, campaign_id: row.campaign_id == null ? null : String(row.campaign_id) });
  res.json({ ok: true, unread: await unreadCount(req.user.id) });
});

// Preferences

notificationsRouter.get("/preferences", async (req, res) => {
  const row = await one("SELECT notification_prefs FROM profiles WHERE user_id = $1", [req.user.id]);
  res.json({ preferences: { ...DEFAULT_PREFS, ...(row?.notification_prefs || {}) } });
});

const Prefs = z
  .object({ push: z.boolean(), reminders: z.boolean(), announcements: z.boolean() })
  .partial()
  .strict()
  .refine((v) => Object.keys(v).length > 0, "Send at least one of push, reminders or announcements.");

notificationsRouter.patch("/preferences", async (req, res) => {
  const patch = Prefs.parse(req.body);
  const row = await one(
    `INSERT INTO profiles (user_id, notification_prefs) VALUES ($1, $2::jsonb || $3::jsonb)
     ON CONFLICT (user_id) DO UPDATE SET notification_prefs = profiles.notification_prefs || $3::jsonb, updated_at = now()
     RETURNING notification_prefs`,
    [req.user.id, DEFAULT_PREFS, patch]
  );
  res.json({ preferences: { ...DEFAULT_PREFS, ...row.notification_prefs } });
});

// Push tokens

const TokenBody = z.object({
  token: z.string().trim().regex(EXPO_TOKEN_RE, "Use an Expo push token like ExponentPushToken[...]."),
  platform: z.enum(["ios", "android", "web"]).optional()
});

notificationsRouter.post("/push-tokens", async (req, res) => {
  const { token, platform } = TokenBody.parse(req.body);
  // A device that changes hands (sign out, sign in as someone else) moves to the new user.
  await query(
    `INSERT INTO push_tokens (user_id, token, platform) VALUES ($1, $2, $3)
     ON CONFLICT (token) DO UPDATE SET user_id = EXCLUDED.user_id, platform = coalesce(EXCLUDED.platform, push_tokens.platform), last_used_at = now()`,
    [req.user.id, token, platform ?? null]
  );
  res.status(201).json({ ok: true });
});

notificationsRouter.delete("/push-tokens", async (req, res) => {
  const { token } = z.object({ token: z.string().trim().min(1).max(300) }).parse(req.body ?? {});
  const r = await query("DELETE FROM push_tokens WHERE token = $1 AND user_id = $2", [token, req.user.id]);
  res.json({ ok: true, removed: r.rowCount });
});
