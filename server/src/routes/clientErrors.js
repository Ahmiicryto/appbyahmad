import { Router } from "express";
import rateLimit from "express-rate-limit";
import jwt from "jsonwebtoken";
import { z } from "zod";
import { config } from "../config.js";
import { one } from "../db/pool.js";
import { logError } from "../services/errorLog.js";

// Crash reports from the phone app and the admin dashboard. Mounted before auth: a signed-in
// user is attached when a valid token is sent, but a token is never required.
export const clientErrorsRouter = Router();

const limiter = rateLimit({
  windowMs: 60 * 1000,
  limit: config.NODE_ENV === "test" ? 1000 : 30,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { error: { code: "rate_limited", message: "Too many error reports. Try again in a minute." } }
});

const cut = (max) => z.string().transform((s) => s.slice(0, max));

const ClientError = z.object({
  message: z.string().trim().min(1, "message is required.").transform((s) => s.slice(0, 2000)),
  stack: cut(8000).nullish(),
  path: cut(500).nullish(),
  platform: cut(40).nullish(),
  app_version: cut(40).nullish(),
  level: z.enum(["error", "warn", "fatal"]).optional(),
  source: z.enum(["app", "admin"]).optional()
});

// Best effort: a missing, expired or stale token just means the report is anonymous.
async function userIdFrom(req) {
  const header = req.get("authorization") || "";
  if (!header.startsWith("Bearer ")) return null;
  try {
    const payload = jwt.verify(header.slice(7), config.JWT_SECRET);
    if (!z.uuid().safeParse(payload?.sub).success) return null;
    const user = await one("SELECT id FROM users WHERE id = $1", [payload.sub]);
    return user?.id ?? null;
  } catch {
    return null;
  }
}

clientErrorsRouter.post("/", limiter, async (req, res) => {
  const input = ClientError.parse(req.body ?? {});
  const meta = {};
  if (input.platform) meta.platform = input.platform;
  if (input.app_version) meta.app_version = input.app_version;
  await logError({
    source: input.source === "admin" ? "admin" : "app",
    level: input.level ?? "error",
    message: input.message,
    stack: input.stack ?? null,
    path: input.path ?? null,
    userId: await userIdFrom(req),
    meta
  });
  res.status(204).end();
});
