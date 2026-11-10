import { Router } from "express";
import { z } from "zod";
import { one, query } from "../db/pool.js";
import { requireAuth } from "../lib/auth.js";
import { decrypt, encrypt } from "../lib/crypto.js";
import { addDays, isYmd, todayIn } from "../lib/dates.js";
import { badRequest, forbidden, notFound } from "../lib/errors.js";
import { track } from "../services/activity.js";

// Letters to your future self. The text stays sealed (never sent to the app) until the unlock date.
export const futureRouter = Router();
futureRouter.use(requireAuth);

const today = async (userId) => todayIn((await one("SELECT timezone FROM profiles WHERE user_id = $1", [userId]))?.timezone || "UTC");

const view = (row, day) => {
  const unlocked = row.unlock_on <= day;
  return { id: row.id, title: row.title, unlock_on: row.unlock_on, created_at: row.created_at, opened_at: row.opened_at, unlocked, ...(unlocked ? { body: decrypt(row.body_enc) } : {}) };
};

futureRouter.get("/", async (req, res) => {
  const day = await today(req.user.id);
  const { rows } = await query("SELECT id, title, body_enc, unlock_on::text AS unlock_on, opened_at, created_at FROM future_letters WHERE user_id = $1 ORDER BY unlock_on, created_at", [req.user.id]);
  res.json({ today: day, letters: rows.map((r) => view(r, day)) });
});

const Body = z.object({
  title: z.string().trim().min(1, "Give your letter a title.").max(80),
  body: z.string().trim().min(1, "Write something to your future self.").max(10000),
  unlock_on: z.string().refine(isYmd, "Use YYYY-MM-DD.")
}).strict();

futureRouter.post("/", async (req, res) => {
  const b = Body.parse(req.body ?? {});
  const day = await today(req.user.id);
  if (b.unlock_on <= day) throw badRequest("Pick a date in the future.", "date_in_past");
  if (b.unlock_on > addDays(day, 3660)) throw badRequest("Pick a date within 10 years.", "date_too_far");
  const { n } = await one("SELECT count(*)::int AS n FROM future_letters WHERE user_id = $1", [req.user.id]);
  if (n >= 100) throw badRequest("You can keep up to 100 letters.", "letter_limit");
  await query("INSERT INTO future_letters (user_id, title, body_enc, unlock_on) VALUES ($1, $2, $3, $4)", [req.user.id, b.title, encrypt(b.body), b.unlock_on]);
  track(req.user.id, "future.letter_written");
  const { rows } = await query("SELECT id, title, body_enc, unlock_on::text AS unlock_on, opened_at, created_at FROM future_letters WHERE user_id = $1 ORDER BY unlock_on, created_at", [req.user.id]);
  res.status(201).json({ today: day, letters: rows.map((r) => view(r, day)) });
});

futureRouter.post("/:id/open", async (req, res) => {
  const day = await today(req.user.id);
  const row = await one("SELECT id, title, body_enc, unlock_on::text AS unlock_on, opened_at, created_at FROM future_letters WHERE id::text = $1 AND user_id = $2", [req.params.id, req.user.id]);
  if (!row) throw notFound("Letter not found.");
  if (row.unlock_on > day) throw forbidden(`This letter opens on ${row.unlock_on}.`);
  if (!row.opened_at) await query("UPDATE future_letters SET opened_at = now() WHERE id = $1", [row.id]);
  res.json({ letter: view({ ...row, opened_at: row.opened_at ?? new Date().toISOString() }, day) });
});

futureRouter.delete("/:id", async (req, res) => {
  const r = await one("DELETE FROM future_letters WHERE id::text = $1 AND user_id = $2 RETURNING id", [req.params.id, req.user.id]);
  if (!r) throw notFound("Letter not found.");
  res.status(204).end();
});
