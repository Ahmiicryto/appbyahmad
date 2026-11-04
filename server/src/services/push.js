import { query } from "../db/pool.js";
import { logger } from "../logger.js";
import { logError } from "./errorLog.js";
import { getSetting } from "./settings.js";

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";
const CHUNK = 100;

export const EXPO_TOKEN_RE = /^Expo(nent)?PushToken\[[^\]\s]{10,200}\]$/;

// Sends one chunk (≤100 messages) to Expo. Returns the parsed JSON body ({data: tickets[]}).
async function fetchTransport(messages, { accessToken } = {}) {
  const headers = { "Content-Type": "application/json", Accept: "application/json", "Accept-Encoding": "gzip, deflate" };
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`;
  const res = await fetch(EXPO_PUSH_URL, { method: "POST", headers, body: JSON.stringify(messages), signal: AbortSignal.timeout(15_000) });
  const body = await res.json().catch(() => null);
  if (!res.ok) {
    const msg = body?.errors?.[0]?.message || `HTTP ${res.status}`;
    throw new Error(`Expo push request failed: ${msg}`);
  }
  return body;
}

let transport = fetchTransport;

// Tests replace the HTTP call: fn(messages, {accessToken}) => {data: [{status, details?}]}. Pass null to restore.
export function setPushTransportForTests(fn) {
  transport = fn || fetchTransport;
}

/**
 * Sends a push to every registered device of the given users.
 * Skips users with notification_prefs.push = false, and also those who turned off `pref`
 * ('announcements' for admin campaigns, 'reminders' for reminders) when given.
 * Never throws. Returns {sent, failed}.
 */
export async function sendPush(userIds, { title, body, data = {} }, { pref = null } = {}) {
  const result = { sent: 0, failed: 0 };
  if (!userIds?.length) return result;
  try {
    const { rows: tokens } = await query(
      `SELECT t.token
         FROM push_tokens t
         JOIN users u ON u.id = t.user_id
         LEFT JOIN profiles p ON p.user_id = t.user_id
        WHERE t.user_id = ANY($1::uuid[])
          AND u.status <> 'suspended'
          AND coalesce((p.notification_prefs->>'push')::boolean, true)
          AND ($2::text IS NULL OR coalesce((p.notification_prefs->>$2::text)::boolean, true))`,
      [userIds, pref === "announcements" || pref === "reminders" ? pref : null]
    );
    if (!tokens.length) return result;

    const accessToken = await getSetting("expo_access_token").catch(() => null);
    const dead = [];
    const delivered = [];
    for (let i = 0; i < tokens.length; i += CHUNK) {
      const slice = tokens.slice(i, i + CHUNK);
      const messages = slice.map(({ token }) => ({ to: token, title, body, data, sound: "default", channelId: "default" }));
      try {
        const resp = await transport(messages, { accessToken });
        const tickets = Array.isArray(resp?.data) ? resp.data : [];
        slice.forEach(({ token }, idx) => {
          const t = tickets[idx];
          if (t?.status === "ok") {
            result.sent++;
            delivered.push(token);
          }
          else {
            result.failed++;
            if (t?.details?.error === "DeviceNotRegistered") dead.push(token);
          }
        });
      } catch (err) {
        result.failed += slice.length;
        logError({ message: err.message, stack: err.stack, path: "push.send", meta: { chunk: slice.length } });
      }
    }
    if (dead.length) await query("DELETE FROM push_tokens WHERE token = ANY($1::text[])", [dead]);
    if (delivered.length) await query("UPDATE push_tokens SET last_used_at = now() WHERE token = ANY($1::text[])", [delivered]);
  } catch (err) {
    logger.warn({ err: err.message }, "push send failed");
    logError({ message: err.message, stack: err.stack, path: "push.send" });
  }
  return result;
}
