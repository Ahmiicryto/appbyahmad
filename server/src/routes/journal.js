import { Router } from "express";
import { z } from "zod";
import { one, query } from "../db/pool.js";
import { requireAuth } from "../lib/auth.js";
import { decrypt, encrypt } from "../lib/crypto.js";
import { notFound } from "../lib/errors.js";

// Private by design: entries are encrypted at rest and never exposed to the admin dashboard.
export const journalRouter = Router();
journalRouter.use(requireAuth);

const MOODS = ["happy", "good", "neutral", "sad", "stressed"];

const view = (row) => ({ id: row.id, mood: row.mood, body: decrypt(row.body_enc), created_at: row.created_at });

journalRouter.get("/", async (req, res) => {
  const q = typeof req.query.q === "string" ? req.query.q.trim().toLowerCase() : "";
  // Search runs after decryption, so scan a bounded window of recent entries.
  const { rows } = await query(
    "SELECT * FROM journal_entries WHERE user_id = $1 ORDER BY created_at DESC LIMIT $2",
    [req.user.id, q ? 500 : 100]
  );
  let entries = rows.map(view);
  if (q) entries = entries.filter((e) => e.body.toLowerCase().includes(q)).slice(0, 100);
  res.json({ entries });
});

journalRouter.post("/", async (req, res) => {
  const { body, mood } = z
    .object({ body: z.string().trim().min(1, "Write something first.").max(20000), mood: z.enum(MOODS).optional() })
    .parse(req.body);
  const row = await one("INSERT INTO journal_entries (user_id, mood, body_enc) VALUES ($1, $2, $3) RETURNING *", [
    req.user.id,
    mood ?? null,
    encrypt(body)
  ]);
  res.status(201).json({ entry: view(row) });
});

journalRouter.delete("/:id", async (req, res) => {
  if (!z.uuid().safeParse(req.params.id).success) throw notFound("Entry not found.");
  const r = await query("DELETE FROM journal_entries WHERE id = $1 AND user_id = $2", [req.params.id, req.user.id]);
  if (!r.rowCount) throw notFound("Entry not found.");
  res.status(204).end();
});
