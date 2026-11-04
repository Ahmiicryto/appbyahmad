import jwt from "jsonwebtoken";
import { config } from "../config.js";
import { one } from "../db/pool.js";
import { getSettings } from "../services/settings.js";

// Paths that keep working during maintenance, so admins can sign in and the app can show the message.
// /api/billing/return is where Stripe sends people after paying, so it must never show a 503.
const ALLOW_EXACT = new Set(["/api/auth/login", "/api/auth/me", "/api/app-config", "/api/client-errors", "/api/billing/webhook", "/api/billing/return"]);
const ALLOW_PREFIX = ["/api/admin/", "/api/app-config/", "/api/client-errors/"];

function isAllowedPath(req) {
  // Mounted at /api, so req.path is relative; use the full URL without the query string.
  const path = (req.originalUrl || req.url).split("?")[0].replace(/\/+$/, "") || "/";
  return ALLOW_EXACT.has(path) || path === "/api/admin" || ALLOW_PREFIX.some((p) => path.startsWith(p));
}

// The token's role claim can be stale (tokens last 30 days), so confirm against the database.
async function isAdminToken(req) {
  const header = req.get("authorization") || "";
  if (!header.startsWith("Bearer ")) return false;
  let payload;
  try {
    payload = jwt.verify(header.slice(7), config.JWT_SECRET);
  } catch {
    return false;
  }
  if (payload?.role !== "admin" || typeof payload.sub !== "string") return false;
  const user = await one("SELECT role, status FROM users WHERE id::text = $1", [payload.sub]).catch(() => null);
  return user?.role === "admin" && user.status === "active";
}

// Blocks the app API while maintenance mode is on.
export async function maintenanceGate(req, res, next) {
  const { maintenance_mode: on, maintenance_message: message } = await getSettings(["maintenance_mode", "maintenance_message"]);
  if (!on || req.method === "OPTIONS" || isAllowedPath(req) || (await isAdminToken(req))) return next();
  res.set({ "Cache-Control": "no-store", "Retry-After": "120" });
  res.status(503).json({ error: { code: "maintenance", message } });
}
