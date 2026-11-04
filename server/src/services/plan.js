import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import { query } from "../db/pool.js";
import { logger } from "../logger.js";
import { getSetting } from "./settings.js";

// What the model must return. Ranges are enforced after parsing (normalizePlan).
const PlanSchema = z.object({
  summary: z.string(),
  category: z.enum(["business", "fitness", "money", "career", "learning", "personal"]),
  milestones: z.array(z.object({ title: z.string(), weeks_from_start: z.number().int() })),
  first_week_tasks: z.array(z.object({ title: z.string(), day: z.number().int() }))
});

const SYSTEM = `You are the planning engine of a personal life-management app.
Turn the user's goal into a realistic plan they can start today.
- 3 to 6 milestones, ordered, each a concrete outcome (not an activity), spread up to the deadline.
- 3 to 7 tasks for the first week, each doable in under 90 minutes, written as short imperative phrases.
  "day" is 0 for today through 6.
- Use the profile (body metrics, job, schedule) when it matters; never invent facts about the user.
- For money goals, give general guidance only, not regulated financial advice.
- For fitness or nutrition goals, keep targets safe and gradual.
- The summary is one or two encouraging sentences addressed to the user.`;

// The API key and model are live settings: an admin can change them without a redeploy.
let client;
let clientKey;
async function anthropic() {
  const key = await getSetting("anthropic_api_key");
  if (!client || clientKey !== key) {
    client = new Anthropic({ apiKey: key });
    clientKey = key;
  }
  return client;
}

export async function aiEnabled() {
  return Boolean((await getSetting("ai_enabled")) && (await getSetting("anthropic_api_key")));
}

export async function generatePlan({ userId, goal, profile, today }) {
  if (await aiEnabled()) {
    try {
      const plan = await aiPlan({ userId, goal, profile, today });
      if (plan) return { ...normalizePlan(plan, goal, today), source: "ai" };
    } catch (err) {
      logger.warn({ err: err.message, status: err.status }, "AI plan failed; using template");
    }
  }
  return { ...normalizePlan(templatePlan(goal), goal, today), source: "template" };
}

async function aiPlan({ userId, goal, profile, today }) {
  const facts = {
    today,
    goal: goal.title,
    current_situation: goal.current_situation || null,
    target: goal.target || null,
    deadline: goal.deadline || null,
    reason: goal.reason || null,
    profile: profile
      ? {
          occupation: profile.occupation,
          aspiration: profile.aspiration,
          height_cm: profile.height_cm,
          weight_kg: profile.weight_kg,
          units: profile.units,
          currency: profile.currency
        }
      : null
  };
  const model = await getSetting("ai_model");
  const response = await (await anthropic()).beta.messages.parse({
    model,
    max_tokens: 16000,
    // If the main model declines, the API re-runs the request on a fallback model.
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    output_config: { format: zodOutputFormat(PlanSchema), effort: "low" },
    system: SYSTEM,
    messages: [{ role: "user", content: `Create my plan.\n\n${JSON.stringify(facts, null, 2)}` }]
  });
  await recordUsage(userId, "goal_plan", response);
  if (response.stop_reason === "refusal") return null;
  return response.parsed_output ?? null;
}

export async function recordUsage(userId, kind, response) {
  await query("INSERT INTO ai_usage (user_id, kind, model, input_tokens, output_tokens) VALUES ($1, $2, $3, $4, $5)", [
    userId,
    kind,
    response.model ?? (await getSetting("ai_model")),
    response.usage?.input_tokens ?? 0,
    response.usage?.output_tokens ?? 0
  ]).catch((err) => logger.warn({ err: err.message }, "failed to record AI usage"));
}

// Works with no AI key so the app is usable from day one.
export function templatePlan(goal) {
  const t = goal.title.trim();
  return {
    summary: `Here's a step-by-step plan for "${t}". We'll adjust it as you go.`,
    category: guessCategory(t),
    milestones: [
      { title: "Get clear on where you are and what done looks like", weeks_from_start: 1 },
      { title: "Build the habits and tools you need", weeks_from_start: 4 },
      { title: "Reach the halfway point", weeks_from_start: 8 },
      { title: `Achieve: ${t}`, weeks_from_start: 12 }
    ],
    first_week_tasks: [
      { title: "Write down your starting point", day: 0 },
      { title: "List 3 things that will help most", day: 1 },
      { title: "Block 30 minutes in your calendar for this goal", day: 2 },
      { title: "Do the first small step", day: 3 },
      { title: "Review the week and note what got in the way", day: 6 }
    ]
  };
}

const CATEGORY_WORDS = {
  fitness: ["kg", "lbs", "weight", "lose", "run", "gym", "workout", "fit", "muscle", "marathon"],
  money: ["save", "$", "debt", "money", "invest", "budget", "income"],
  business: ["business", "startup", "launch", "customers", "revenue", "/month"],
  career: ["job", "career", "promotion", "interview", "resume", "salary"],
  learning: ["learn", "read", "books", "course", "language", "skill"]
};

export function guessCategory(title) {
  const s = title.toLowerCase();
  for (const [cat, words] of Object.entries(CATEGORY_WORDS)) {
    if (words.some((w) => s.includes(w))) return cat;
  }
  return "personal";
}

// Clamp counts and ranges, and turn relative weeks/days into dates.
export function normalizePlan(plan, goal, today) {
  const start = new Date(`${today}T00:00:00Z`);
  const deadline = goal.deadline ? new Date(`${goal.deadline}T00:00:00Z`) : null;
  const toDate = (days) => {
    const d = new Date(start);
    d.setUTCDate(d.getUTCDate() + days);
    if (deadline && d > deadline) return goal.deadline;
    return d.toISOString().slice(0, 10);
  };
  const milestones = plan.milestones
    .filter((m) => m.title?.trim())
    .slice(0, 6)
    .sort((a, b) => a.weeks_from_start - b.weeks_from_start)
    .map((m) => ({ title: m.title.trim().slice(0, 200), due_date: toDate(Math.max(1, m.weeks_from_start) * 7) }));
  const tasks = plan.first_week_tasks
    .filter((t) => t.title?.trim())
    .slice(0, 7)
    .map((t) => ({ title: t.title.trim().slice(0, 200), due_date: toDate(Math.min(6, Math.max(0, t.day))) }));
  return {
    summary: (plan.summary || "").slice(0, 500),
    category: plan.category || guessCategory(goal.title),
    milestones,
    tasks
  };
}
