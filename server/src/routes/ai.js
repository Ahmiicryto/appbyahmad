import { Router } from "express";
import { z } from "zod";
import { one, query } from "../db/pool.js";
import { requireAuth } from "../lib/auth.js";
import { decrypt, encrypt } from "../lib/crypto.js";
import { notFound } from "../lib/errors.js";
import { track } from "../services/activity.js";
import { COACH_STYLE, addDays, askStructured, askText, requireAi, usageToday, userContext } from "../services/ai.js";

export const aiRouter = Router();
aiRouter.use(requireAuth);

const HISTORY = 20; // messages sent back to the model per turn

aiRouter.get("/usage", async (req, res) => {
  res.json(await usageToday(req.user));
});

// ---------------------------------------------------------------- chat

aiRouter.get("/chat", async (req, res) => {
  const { rows } = await query("SELECT id, role, content_enc, created_at FROM ai_messages WHERE user_id = $1 ORDER BY id DESC LIMIT 100", [req.user.id]);
  res.json({
    messages: rows.reverse().map((r) => ({ id: String(r.id), role: r.role, content: decrypt(r.content_enc), created_at: r.created_at })),
    usage: await usageToday(req.user)
  });
});

const ChatBody = z.object({ text: z.string().trim().min(1, "Type a message.").max(2000, "Keep it under 2,000 characters.") }).strict();

aiRouter.post("/chat", async (req, res) => {
  const { text } = ChatBody.parse(req.body ?? {});
  await requireAi(req.user);
  const { rows } = await query("SELECT role, content_enc FROM ai_messages WHERE user_id = $1 ORDER BY id DESC LIMIT $2", [req.user.id, HISTORY]);
  const history = rows.reverse().map((r) => ({ role: r.role, content: decrypt(r.content_enc) }));
  // The API needs the conversation to start with a user turn.
  while (history.length && history[0].role !== "user") history.shift();
  const context = await userContext(req.user.id);
  const system = `${COACH_STYLE}
Answer the user's question in under 180 words unless they ask for detail. Use short lists when listing steps.
When you suggest tasks, make them concrete and doable today.

User data (for grounding, as of ${context.today}):
${JSON.stringify(context)}`;
  const reply = await askText({ userId: req.user.id, kind: "coach.chat", system, messages: [...history, { role: "user", content: text }] });
  await query("INSERT INTO ai_messages (user_id, role, content_enc) VALUES ($1, 'user', $2)", [req.user.id, encrypt(text)]);
  const saved = await one(
    "INSERT INTO ai_messages (user_id, role, content_enc) VALUES ($1, 'assistant', $2) RETURNING id, created_at",
    [req.user.id, encrypt(reply)]
  );
  track(req.user.id, "ai.chat");
  res.json({ message: { id: String(saved.id), role: "assistant", content: reply, created_at: saved.created_at }, usage: await usageToday(req.user) });
});

aiRouter.delete("/chat", async (req, res) => {
  await query("DELETE FROM ai_messages WHERE user_id = $1", [req.user.id]);
  res.status(204).end();
});

// ---------------------------------------------------------------- plan my day

const DayPlan = z.object({
  summary: z.string(),
  tasks: z.array(
    z.object({
      title: z.string(),
      goal_id: z.string().nullable(),
      source: z.enum(["goal", "fitness", "money", "career", "custom"]),
      minutes: z.number().int(),
      time_of_day: z.enum(["morning", "afternoon", "evening", "anytime"]),
      why: z.string()
    })
  )
});

aiRouter.post("/plan-day", async (req, res) => {
  await requireAi(req.user);
  const context = await userContext(req.user.id);
  const plan = await askStructured({
    userId: req.user.id,
    kind: "coach.plan_day",
    schema: DayPlan,
    system: `${COACH_STYLE}
You plan the user's day. Suggest 3 to 5 focused tasks for ${context.weekday} ${context.today} that move their active goals forward,
skipping anything already on today's list. Each title is a short imperative phrase (max 60 characters), doable in 15-90 minutes.
Use the exact goal id from the data for goal tasks (goal_id), otherwise null. "why" is one short sentence linking it to their goal or pattern.
"summary" is one or two sentences: the focus for today, based on their recent consistency and moods.`,
    content: `Plan my day.\n\n${JSON.stringify(context)}`
  });
  const goalIds = new Set(context.active_goals.map((g) => g.id));
  const tasks = plan.tasks.slice(0, 6).map((t) => ({
    title: t.title.slice(0, 120),
    goal_id: t.goal_id && goalIds.has(t.goal_id) ? t.goal_id : null,
    source: t.source === "goal" ? "custom" : t.source,
    minutes: Math.min(240, Math.max(5, t.minutes)),
    time_of_day: t.time_of_day,
    why: t.why.slice(0, 200)
  }));
  track(req.user.id, "ai.plan_day", { suggestions: tasks.length });
  res.json({ summary: plan.summary, tasks, usage: await usageToday(req.user) });
});

// ---------------------------------------------------------------- journal reflection

const Reflection = z.object({
  reflection: z.string(),
  themes: z.array(z.string()),
  suggestion: z.string()
});

aiRouter.post("/journal/:id/reflect", async (req, res) => {
  const entry = await one("SELECT id, mood, body_enc, reflection_enc FROM journal_entries WHERE id::text = $1 AND user_id = $2", [req.params.id, req.user.id]);
  if (!entry) throw notFound("Entry not found.");
  if (entry.reflection_enc) return res.json({ ...JSON.parse(decrypt(entry.reflection_enc)), cached: true });
  await requireAi(req.user);
  const r = await askStructured({
    userId: req.user.id,
    kind: "coach.reflect",
    schema: Reflection,
    system: `${COACH_STYLE}
The user wrote a private journal entry and asked for a reflection. Read it with empathy.
"reflection": 2-3 sentences mirroring what you notice (feelings, what mattered), without judging or diagnosing.
"themes": 1-3 short theme labels (one or two words each, sentence case).
"suggestion": one gentle, specific next step for tomorrow.`,
    content: `Mood: ${entry.mood || "not set"}\n\nEntry:\n${decrypt(entry.body_enc)}`
  });
  const out = { reflection: r.reflection, themes: r.themes.slice(0, 3), suggestion: r.suggestion };
  await query("UPDATE journal_entries SET reflection_enc = $2 WHERE id = $1", [entry.id, encrypt(JSON.stringify(out))]);
  track(req.user.id, "ai.reflect");
  res.json({ ...out, cached: false });
});

// ---------------------------------------------------------------- weekly review

const Review = z.object({
  headline: z.string(),
  wins: z.array(z.string()),
  patterns: z.array(z.string()),
  next_week: z.array(z.string())
});

const weekStart = (today) => {
  const d = new Date(`${today}T12:00:00Z`).getUTCDay(); // 0 = Sunday
  return addDays(today, -((d + 6) % 7)); // Monday
};

aiRouter.get("/weekly-review", async (req, res) => {
  const context = await userContext(req.user.id);
  const week = weekStart(context.today);
  const row = await one("SELECT data, created_at FROM ai_reviews WHERE user_id = $1 AND week_start = $2", [req.user.id, week]);
  res.json({ week_start: week, review: row ? { ...row.data, created_at: row.created_at } : null });
});

aiRouter.post("/weekly-review", async (req, res) => {
  await requireAi(req.user);
  const context = await userContext(req.user.id);
  const week = weekStart(context.today);
  const r = await askStructured({
    userId: req.user.id,
    kind: "coach.weekly_review",
    schema: Review,
    effort: "medium",
    system: `${COACH_STYLE}
Write the user's weekly life review from their last 7 days of tasks, goal progress, Life Score and moods.
"headline": one sentence capturing the week honestly and kindly.
"wins": 2-3 specific things that went well, with numbers where the data has them.
"patterns": 1-3 observations (e.g. which days or areas slipped, mood trends) without blame.
"next_week": 3 concrete focus points for next week.
If there is little data, say so briefly and make "next_week" about building the habit of planning.`,
    content: `Write my weekly review.\n\n${JSON.stringify(context)}`
  });
  const data = { headline: r.headline, wins: r.wins.slice(0, 3), patterns: r.patterns.slice(0, 3), next_week: r.next_week.slice(0, 3) };
  const saved = await one(
    `INSERT INTO ai_reviews (user_id, week_start, data) VALUES ($1, $2, $3)
     ON CONFLICT (user_id, week_start) DO UPDATE SET data = EXCLUDED.data, created_at = now() RETURNING created_at`,
    [req.user.id, week, data]
  );
  track(req.user.id, "ai.weekly_review");
  res.json({ week_start: week, review: { ...data, created_at: saved.created_at }, usage: await usageToday(req.user) });
});
