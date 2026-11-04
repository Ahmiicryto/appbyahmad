import { Router } from "express";
import { z } from "zod";
import { one, query } from "../db/pool.js";
import { requireAdmin, requireAuth } from "../lib/auth.js";
import { audit } from "../services/audit.js";
import { logError } from "../services/errorLog.js";
import { Audience, audienceQuery } from "../services/notify.js";
import { sendPush } from "../services/push.js";

export const adminNotificationsRouter = Router();
adminNotificationsRouter.use(requireAuth, requireAdmin);

// Counts for an audience: everyone who gets the inbox message, and who of those would also get a push.
async function countAudience(audience) {
  const { sql, params } = audienceQuery(audience);
  return one(
    `WITH a AS (${sql})
     SELECT (SELECT count(*)::int FROM a) AS recipients,
            (SELECT count(DISTINCT a.id)::int FROM a
               JOIN push_tokens t ON t.user_id = a.id
               LEFT JOIN profiles p ON p.user_id = a.id
              WHERE coalesce((p.notification_prefs->>'push')::boolean, true)
                AND coalesce((p.notification_prefs->>'announcements')::boolean, true)) AS "withPush"`,
    params
  );
}

adminNotificationsRouter.post("/preview", async (req, res) => {
  const { audience } = z.object({ audience: Audience }).parse(req.body);
  res.json(await countAudience(audience));
});

// In-app route ("/goals", "/journal?x=1"; not "//host") or a full https link.
const Url = z
  .string()
  .trim()
  .max(500)
  .refine((v) => /^\/(?!\/)[A-Za-z0-9\-._~/?#[\]@!$&'()*+,;=%]*$/.test(v) || /^https:\/\/[^\s]+$/i.test(v), {
    message: 'Use an in-app route like "/goals" or a link that starts with https://'
  });

const SendBody = z.object({
  title: z.string().trim().min(1, "Add a title.").max(65, "Keep the title to 65 characters or fewer."),
  body: z.string().trim().min(1, "Add a message.").max(240, "Keep the message to 240 characters or fewer."),
  url: z.union([Url, z.literal(""), z.null()]).optional(),
  audience: Audience,
  send_push: z.boolean().default(true)
});

adminNotificationsRouter.post("/send", async (req, res) => {
  const input = SendBody.parse(req.body);
  const data = input.url ? { url: input.url } : {};
  const campaign = await one(
    `INSERT INTO notification_campaigns (title, body, data, audience, send_push, status, created_by)
     VALUES ($1, $2, $3, $4, $5, 'sending', $6) RETURNING id`,
    [input.title, input.body, data, input.audience, input.send_push, req.user.id]
  );
  const campaignData = { ...data, campaignId: String(campaign.id) };

  let recipients = 0;
  let push = { sent: 0, failed: 0 };
  let status = "sent";
  try {
    const { sql, params } = audienceQuery(input.audience);
    const n = params.length;
    // One INSERT ... SELECT for the whole audience.
    const { rows } = await query(
      `INSERT INTO notifications (user_id, campaign_id, kind, title, body, data)
       SELECT a.id, $${n + 1}, 'announcement', $${n + 2}, $${n + 3}, $${n + 4} FROM (${sql}) a
       RETURNING user_id`,
      [...params, campaign.id, input.title, input.body, campaignData]
    );
    recipients = rows.length;
    if (input.send_push && recipients) {
      push = await sendPush(
        rows.map((r) => r.user_id),
        { title: input.title, body: input.body, data: campaignData },
        { pref: "announcements" }
      );
    }
  } catch (err) {
    status = "failed";
    logError({ message: err.message, stack: err.stack, path: "admin.notifications.send", userId: req.user.id, meta: { campaignId: String(campaign.id) } });
  }

  const row = await one(
    `UPDATE notification_campaigns SET status = $2, recipients = $3, push_sent = $4, push_failed = $5
      WHERE id = $1 RETURNING *`,
    [campaign.id, status, recipients, push.sent, push.failed]
  );
  await audit(req.user.id, "notification.sent", "notification_campaign", campaign.id, {
    audience: input.audience,
    recipients,
    push_sent: push.sent,
    push_failed: push.failed,
    status
  });
  if (status === "failed") {
    return res.status(500).json({
      error: { code: "send_failed", message: "The notification couldn't be sent. Check Error logs, then try again." },
      campaign: { ...row, id: String(row.id) }
    });
  }
  res.status(201).json({ campaign: { ...row, id: String(row.id) } });
});

adminNotificationsRouter.get("/campaigns", async (req, res) => {
  const { rows } = await query(
    `SELECT c.id::text AS id, c.title, c.body, c.data, c.audience, c.send_push, c.status,
            c.recipients, c.push_sent, c.push_failed, c.created_at, u.email AS created_by_email,
            (SELECT count(*)::int FROM notifications n WHERE n.campaign_id = c.id AND n.read_at IS NOT NULL) AS read_count
       FROM notification_campaigns c LEFT JOIN users u ON u.id = c.created_by
      ORDER BY c.created_at DESC, c.id DESC LIMIT 50`
  );
  res.json({ campaigns: rows });
});

adminNotificationsRouter.get("/stats", async (req, res) => {
  const s = await one(`
    SELECT
      (SELECT count(*)::int FROM push_tokens) AS push_tokens,
      (SELECT count(DISTINCT user_id)::int FROM push_tokens) AS users_with_push,
      (SELECT count(*)::int FROM notification_campaigns WHERE created_at > now() - interval '30 days') AS campaigns_30d,
      (SELECT count(*)::int FROM notifications WHERE created_at > now() - interval '30 days') AS sent_30d,
      (SELECT count(*)::int FROM notifications WHERE created_at > now() - interval '30 days' AND read_at IS NOT NULL) AS read_30d
  `);
  res.json({ ...s, read_rate_30d: s.sent_30d ? s.read_30d / s.sent_30d : null });
});
