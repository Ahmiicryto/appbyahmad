// AI features: coach chat, "Plan my day", journal reflections and the weekly review.
// Every call is grounded in the user's own data (profile, goals, tasks, moods), counted in ai_usage
// for the admin dashboard, and limited per day by plan (admin → Settings → Limits).
// The provider (Claude, ChatGPT, Grok, Gemini, …) is chosen in admin → Settings → AI.
import { one, query } from "../db/pool.js";
import { HttpError, paymentRequired } from "../lib/errors.js";
import { addDays, todayIn } from "../lib/dates.js";
import { aiConfigured, generateStructured, generateText, ProviderError, setAnthropicClientForTests } from "./aiProvider.js";
import { lifeScore } from "./lifeScore.js";
import { getSetting } from "./settings.js";

// Tests inject a fake Claude client; nothing in tests reaches a real API.
export const setAiClientForTests = setAnthropicClientForTests;

export class AiUnavailable extends HttpError {
  constructor(msg = "The AI coach is turned off right now. Please try again later.") {
    super(503, msg, "ai_unavailable");
  }
}

// Throws unless AI is on and the user has requests left today.
export async function requireAi(user) {
  if (!(await aiConfigured())) throw new AiUnavailable();
  const flags = await getSetting("feature_flags");
  if (flags && flags.assistant === false && user.role !== "admin") throw new AiUnavailable("The AI coach isn't available yet.");
  const limit = await getSetting(user.isPremium ? "premium_ai_requests_per_day" : "free_ai_requests_per_day");
  const { n } = await one(
    "SELECT count(*)::int AS n FROM ai_usage WHERE user_id = $1 AND kind LIKE 'coach.%' AND created_at > now() - interval '1 day'",
    [user.id]
  );
  if (n >= limit) {
    throw user.isPremium
      ? new HttpError(429, "You've reached today's AI limit. It resets within 24 hours.", "ai_limit")
      : paymentRequired(`You've used your ${limit} free AI requests for today. Upgrade to Premium for much more.`, "ai_limit");
  }
  return { used: n + 1, limit };
}

export async function usageToday(user) {
  const limit = await getSetting(user.isPremium ? "premium_ai_requests_per_day" : "free_ai_requests_per_day");
  const { n } = await one(
    "SELECT count(*)::int AS n FROM ai_usage WHERE user_id = $1 AND kind LIKE 'coach.%' AND created_at > now() - interval '1 day'",
    [user.id]
  );
  return { used: n, limit, remaining: Math.max(0, limit - n) };
}

// Provider problems become messages people can act on (details stay in the server log).
function friendly(err) {
  if (err instanceof HttpError) return err;
  if (err instanceof ProviderError) {
    if (err.kind === "refusal") return new HttpError(422, "The coach can't help with that request. Try asking another way.", "ai_refused");
    if (err.kind === "rate") return new HttpError(503, "The AI coach is busy. Try again in a minute.", "ai_busy");
    if (err.kind === "auth" || err.kind === "model") return new AiUnavailable();
  }
  return new HttpError(502, "The AI coach couldn't answer just now. Try again in a minute.", "ai_failed");
}

// Structured JSON answer validated against a zod schema.
export async function askStructured({ userId, kind, system, content, schema, effort = "low" }) {
  try {
    return await generateStructured({ system, content, schema, effort, userId, kind });
  } catch (err) {
    throw friendly(err);
  }
}

// Free-text reply for the chat.
export async function askText({ userId, kind, system, messages, effort = "low" }) {
  try {
    return await generateText({ system, messages, effort, userId, kind });
  } catch (err) {
    throw friendly(err);
  }
}

// ---------------------------------------------------------------- user context

const MOODS = { happy: "happy", good: "good", neutral: "okay", sad: "low", stressed: "stressed" };

// A compact, factual snapshot of the user's life for grounding. Never includes journal text.
export async function userContext(userId) {
  const p = await one("SELECT * FROM profiles WHERE user_id = $1", [userId]);
  const today = todayIn(p?.timezone || "UTC");
  const [goals, tasks, moods, score] = await Promise.all([
    query(
      `SELECT g.id, g.title, g.category, g.progress, g.deadline::text AS deadline,
              (SELECT title FROM milestones m WHERE m.goal_id = g.id AND m.status <> 'done' ORDER BY m.position LIMIT 1) AS next_milestone
         FROM goals g WHERE g.user_id = $1 AND g.status = 'active' ORDER BY g.created_at LIMIT 10`,
      [userId]
    ).then((r) => r.rows),
    query(
      `SELECT title, source, due_date::text AS date, due_time, (done_at IS NOT NULL) AS done
         FROM tasks WHERE user_id = $1 AND due_date BETWEEN $2::date - 6 AND $2::date ORDER BY due_date DESC, created_at LIMIT 60`,
      [userId, today]
    ).then((r) => r.rows),
    query(
      "SELECT mood, created_at::date::text AS date FROM journal_entries WHERE user_id = $1 AND mood IS NOT NULL AND created_at > now() - interval '14 days' ORDER BY created_at DESC LIMIT 14",
      [userId]
    ).then((r) => r.rows),
    lifeScore(userId, today)
  ]);
  return {
    today,
    weekday: new Date(`${today}T12:00:00Z`).toLocaleDateString("en-US", { weekday: "long", timeZone: "UTC" }),
    profile: p
      ? { name: p.name, occupation: p.occupation, aspiration: p.aspiration, self_word: p.self_word, units: p.units, currency: p.currency, timezone: p.timezone }
      : null,
    life_score: score,
    active_goals: goals,
    tasks_last_7_days: tasks,
    recent_moods: moods.map((m) => ({ date: m.date, mood: MOODS[m.mood] || m.mood }))
  };
}

export const COACH_STYLE = `You are the personal coach inside Elauxi ("Your Everyday Superpower"), a life-planning app (goals, daily tasks, journal, Life Score).
Voice: warm, direct and practical, like a thoughtful mentor. Short paragraphs, plain words, no emoji, no hype.
Ground every suggestion in the user's own data below; never invent facts about them. If data is missing, say what would help.
Money: general guidance only, not regulated financial advice. Health and fitness: safe, gradual targets; suggest a professional for medical concerns.
If someone mentions self-harm or crisis, respond with care and encourage them to contact local emergency services or a crisis line right away.`;

export { addDays };
