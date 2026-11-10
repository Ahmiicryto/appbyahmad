import { Router } from "express";
import { z } from "zod";
import { one, query } from "../db/pool.js";
import { requireAuth } from "../lib/auth.js";
import { isYmd, todayIn } from "../lib/dates.js";
import { notFound } from "../lib/errors.js";
import { track } from "../services/activity.js";

export const moneyRouter = Router();
moneyRouter.use(requireAuth);

export const CATEGORIES = {
  expense: ["food", "transport", "shopping", "bills", "health", "fun", "education", "home", "other"],
  income: ["salary", "business", "freelance", "gift", "other"]
};
const ALL = [...new Set([...CATEGORIES.expense, ...CATEGORIES.income])];

async function summary(userId, month) {
  const p = await one("SELECT timezone, currency, monthly_budget_cents FROM profiles WHERE user_id = $1", [userId]);
  const m = month || todayIn(p?.timezone || "UTC").slice(0, 7);
  const from = `${m}-01`;
  const { rows } = await query(
    `SELECT id, kind, amount_cents::float AS amount_cents, category, note, day::text AS day, created_at FROM transactions
      WHERE user_id = $1 AND day >= $2::date AND day < ($2::date + interval '1 month') ORDER BY day DESC, created_at DESC LIMIT 500`,
    [userId, from]
  );
  const income = rows.filter((r) => r.kind === "income").reduce((s, r) => s + r.amount_cents, 0);
  const expense = rows.filter((r) => r.kind === "expense").reduce((s, r) => s + r.amount_cents, 0);
  const byCat = {};
  for (const r of rows) if (r.kind === "expense") byCat[r.category] = (byCat[r.category] || 0) + r.amount_cents;
  const budget = p?.monthly_budget_cents == null ? null : Number(p.monthly_budget_cents);
  return {
    month: m,
    currency: p?.currency || "USD",
    income_cents: income,
    expense_cents: expense,
    net_cents: income - expense,
    budget_cents: budget,
    budget_left_cents: budget == null ? null : budget - expense,
    by_category: Object.entries(byCat).map(([category, cents]) => ({ category, cents })).sort((a, b) => b.cents - a.cents),
    transactions: rows,
    categories: CATEGORIES
  };
}

moneyRouter.get("/", async (req, res) => {
  const month = /^\d{4}-\d{2}$/.test(String(req.query.month || "")) ? String(req.query.month) : null;
  res.json(await summary(req.user.id, month));
});

const TxBody = z.object({
  kind: z.enum(["income", "expense"]),
  amount_cents: z.number().int().min(1, "Enter an amount.").max(99_999_999_999),
  category: z.enum(ALL),
  note: z.string().trim().max(120).nullable().optional(),
  day: z.string().refine(isYmd, "Use YYYY-MM-DD.").optional()
}).strict();

moneyRouter.post("/transactions", async (req, res) => {
  const b = TxBody.parse(req.body ?? {});
  const p = await one("SELECT timezone FROM profiles WHERE user_id = $1", [req.user.id]);
  const day = b.day ?? todayIn(p?.timezone || "UTC");
  await query("INSERT INTO transactions (user_id, kind, amount_cents, category, note, day) VALUES ($1, $2, $3, $4, $5, $6)", [
    req.user.id, b.kind, b.amount_cents, b.category, b.note || null, day
  ]);
  track(req.user.id, "money.logged", { kind: b.kind });
  res.status(201).json(await summary(req.user.id, day.slice(0, 7)));
});

moneyRouter.delete("/transactions/:id", async (req, res) => {
  const r = await one("DELETE FROM transactions WHERE id::text = $1 AND user_id = $2 RETURNING day::text AS day", [req.params.id, req.user.id]);
  if (!r) throw notFound("Transaction not found.");
  res.json(await summary(req.user.id, r.day.slice(0, 7)));
});

moneyRouter.put("/budget", async (req, res) => {
  const { budget_cents } = z.object({ budget_cents: z.number().int().min(0).max(99_999_999_999).nullable() }).strict().parse(req.body ?? {});
  await query("UPDATE profiles SET monthly_budget_cents = $2, updated_at = now() WHERE user_id = $1", [req.user.id, budget_cents]);
  res.json(await summary(req.user.id, null));
});
