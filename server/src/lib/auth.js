import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { config } from "../config.js";
import { one, query } from "../db/pool.js";
import { forbidden, unauthorized } from "./errors.js";

export const hashPassword = (pw) => bcrypt.hash(pw, 12);
export const checkPassword = (pw, hash) => bcrypt.compare(pw, hash);

export function signToken(user) {
  return jwt.sign({ sub: user.id, role: user.role }, config.JWT_SECRET, { expiresIn: config.JWT_TTL });
}

// Loads the user on every request so suspensions and role changes apply immediately.
export async function requireAuth(req, res, next) {
  const header = req.get("authorization") || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) throw unauthorized();
  let payload;
  try {
    payload = jwt.verify(token, config.JWT_SECRET);
  } catch {
    throw unauthorized();
  }
  const user = await one("SELECT id, email, role, status, plan, plan_expires_at FROM users WHERE id = $1", [payload.sub]);
  if (!user) throw unauthorized();
  if (user.status === "suspended") throw forbidden("Your account is suspended. Contact support.");
  req.user = { ...user, isPremium: isPremium(user) };
  // Cheap "last seen" for the admin dashboard; at most one write per user per 5 minutes.
  query(
    "UPDATE users SET last_seen_at = now() WHERE id = $1 AND (last_seen_at IS NULL OR last_seen_at < now() - interval '5 minutes')",
    [user.id]
  ).catch(() => {});
  next();
}

export function requireAdmin(req, res, next) {
  if (req.user?.role !== "admin") throw forbidden();
  next();
}

export function isPremium(user) {
  if (user.plan !== "premium") return false;
  return !user.plan_expires_at || new Date(user.plan_expires_at) > new Date();
}

export function publicUser(user) {
  return {
    id: user.id,
    email: user.email,
    role: user.role,
    plan: user.plan,
    isPremium: isPremium(user)
  };
}
