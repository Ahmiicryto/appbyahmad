import { Router } from "express";
import rateLimit from "express-rate-limit";
import { z } from "zod";
import { config } from "../config.js";
import { one, query } from "../db/pool.js";
import { checkPassword, hashPassword, publicUser, requireAuth, signToken } from "../lib/auth.js";
import { badRequest, forbidden, HttpError } from "../lib/errors.js";
import { audit } from "../services/audit.js";
import { getProfile } from "./profile.js";

export const authRouter = Router();

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: config.NODE_ENV === "test" ? 1000 : 20,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { error: { code: "rate_limited", message: "Too many attempts. Wait a few minutes and try again." } }
});

const Credentials = z.object({
  email: z.string().trim().toLowerCase().email().max(254),
  password: z.string().min(8, "Use at least 8 characters.").max(200)
});

authRouter.post("/register", limiter, async (req, res) => {
  if (!config.ALLOW_SIGNUP) throw forbidden("Sign-ups are closed right now.");
  const { email, password } = Credentials.parse(req.body);
  const exists = await one("SELECT 1 FROM users WHERE email = $1", [email]);
  if (exists) throw new HttpError(409, "An account with this email already exists. Sign in instead.", "email_taken");
  const user = await one(
    "INSERT INTO users (email, password_hash) VALUES ($1, $2) RETURNING id, email, role, status, plan, plan_expires_at",
    [email, await hashPassword(password)]
  );
  await query("INSERT INTO profiles (user_id) VALUES ($1)", [user.id]);
  res.status(201).json({ token: signToken(user), user: publicUser(user), profile: await getProfile(user.id) });
});

authRouter.post("/login", limiter, async (req, res) => {
  const { email, password } = Credentials.parse(req.body);
  const user = await one("SELECT * FROM users WHERE email = $1", [email]);
  if (!user || !(await checkPassword(password, user.password_hash))) {
    throw badRequest("That email and password don't match.", "invalid_credentials");
  }
  if (user.status === "suspended") throw forbidden("Your account is suspended. Contact support.");
  await query("UPDATE users SET last_seen_at = now() WHERE id = $1", [user.id]);
  res.json({ token: signToken(user), user: publicUser(user), profile: await getProfile(user.id) });
});

authRouter.get("/me", requireAuth, async (req, res) => {
  res.json({ user: publicUser(req.user), profile: await getProfile(req.user.id) });
});

// Both app stores require in-app account deletion.
authRouter.delete("/me", requireAuth, async (req, res) => {
  const { password } = z.object({ password: z.string() }).parse(req.body);
  const user = await one("SELECT password_hash FROM users WHERE id = $1", [req.user.id]);
  if (!(await checkPassword(password, user.password_hash))) {
    throw badRequest("Password is incorrect.", "invalid_credentials");
  }
  await audit(req.user.id, "account.deleted", "user", req.user.id, { email: req.user.email });
  await query("DELETE FROM users WHERE id = $1", [req.user.id]);
  res.status(204).end();
});
