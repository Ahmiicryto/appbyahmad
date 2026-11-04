import { config } from "../config.js";
import { one, query } from "../db/pool.js";
import { hashPassword } from "../lib/auth.js";
import { logger } from "../logger.js";

// Creates (or promotes) the first admin from ADMIN_EMAIL / ADMIN_PASSWORD on boot.
// An existing account's password is only overwritten when ADMIN_RESET_PASSWORD is on.
export async function ensureAdmin(email = config.ADMIN_EMAIL, password = config.ADMIN_PASSWORD, reset = config.ADMIN_RESET_PASSWORD) {
  if (!email) return null;
  const existing = await one("SELECT id, role FROM users WHERE email = $1", [email.toLowerCase()]);
  if (existing) {
    if (existing.role !== "admin") {
      await query("UPDATE users SET role = 'admin' WHERE id = $1", [existing.id]);
      logger.info({ email }, "promoted existing user to admin");
    }
    if (reset) {
      if (!password || password.length < 12) {
        logger.warn("ADMIN_RESET_PASSWORD is on but ADMIN_PASSWORD is shorter than 12 characters; password not changed");
      } else {
        await query("UPDATE users SET password_hash = $2, status = 'active' WHERE id = $1", [existing.id, await hashPassword(password)]);
        logger.warn({ email }, "admin password reset from ADMIN_PASSWORD; remove ADMIN_RESET_PASSWORD now");
      }
    }
    return existing.id;
  }
  if (!password || password.length < 12) {
    logger.warn({ email }, "Admin NOT created: ADMIN_PASSWORD must be at least 12 characters. Fix it in your hosting variables and redeploy.");
    return null;
  }
  const user = await one("INSERT INTO users (email, password_hash, role) VALUES ($1, $2, 'admin') RETURNING id", [
    email.toLowerCase(),
    await hashPassword(password)
  ]);
  await query("INSERT INTO profiles (user_id, onboarded_at) VALUES ($1, now())", [user.id]);
  logger.info({ email }, "created admin account");
  return user.id;
}
