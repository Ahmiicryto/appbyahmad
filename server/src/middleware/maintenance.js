import jwt from "jsonwebtoken";
import { config } from "../config.js";
import { getSettings } from "../services/settings.js";

// Paths that keep working during maintenance, so admins can sign in and the app can show the message.
const ALLOW_EXACT = new Set(["/api/auth/login", "/api/auth/me", "/api/app-config", "/api/client-errors", "/api/billing/webhook"]);
const ALLOW_PREFIX = ["/api/admin/", "/api/app-config/", "/api/client-errors/"];

function isAllowedPath(req) {
  // Mounted at /api, so req.path is relative; use the full URL without the query string.
  const path = (req.originalUrl || req.url).split("?")[0].replace(/\/+$/, "") || "/";
  return ALLOW_EXACT.has(path) || path === "/api/admin" || ALLOW_PREFIX.some((p) => path.startsWith(p));
}

function isAdminToken(req) {
  const header = req.get("authorization") || "";
  if (!header.startsWith("Bearer ")) return false;
  try {
    return jwt.verify(header.slice(7), config.JWT_SECRET)?.role === "admin";
  } catch {
    return false;
  }
}

// Blocks the app API while maintenance mode is on.
export async function maintenanceGate(req, res, next) {
  const { maintenance_mode: on, maintenance_message: message } = await getSettings(["maintenance_mode", "maintenance_message"]);
  if (!on || req.method === "OPTIONS" || isAllowedPath(req) || isAdminToken(req)) return next();
  res.set({ "Cache-Control": "no-store", "Retry-After": "120" });
  res.status(503).json({ error: { code: "maintenance", message } });
}
