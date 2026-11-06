import { z } from "zod";
import { logger } from "../logger.js";
import { aiConfigured, generateStructured, ProviderError } from "./aiProvider.js";

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

// Provider, model and keys are live settings (admin → Settings → AI), no redeploy needed.
export const aiEnabled = aiConfigured;

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
  try {
    return await generateStructured({
      system: SYSTEM,
      content: `Create my plan.\n\n${JSON.stringify(facts, null, 2)}`,
      schema: PlanSchema,
      effort: "low",
      userId,
      kind: "goal_plan"
    });
  } catch (err) {
    if (err instanceof ProviderError && err.kind === "refusal") return null;
    throw err;
  }
}

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
