// Built-in coach used when no AI provider is set up (or it's switched off): answers from the user's own data
// with simple rules, so the coach, Plan my day and the weekly review always work.

const pct = (a, b) => (b ? Math.round((a / b) * 100) : 0);

function stats(ctx) {
  const tasks = ctx.tasks_last_7_days || [];
  const done = tasks.filter((t) => t.done).length;
  const today = tasks.filter((t) => t.date === ctx.today);
  const open = today.filter((t) => !t.done);
  const byDay = {};
  for (const t of tasks) {
    byDay[t.date] ??= { done: 0, total: 0 };
    byDay[t.date].total++;
    if (t.done) byDay[t.date].done++;
  }
  const activeDays = Object.values(byDay).filter((d) => d.done > 0).length;
  const goals = [...(ctx.active_goals || [])].sort((a, b) => a.progress - b.progress);
  const moods = ctx.recent_moods || [];
  const lowMoods = moods.filter((m) => m.mood === "low" || m.mood === "stressed").length;
  return { tasks, done, total: tasks.length, rate: pct(done, tasks.length), today, open, activeDays, goals, moods, lowMoods };
}

export function builtinReply(ctx, text) {
  const s = stats(ctx);
  const name = ctx.profile?.name ? ctx.profile.name.split(" ")[0] : "";
  const q = String(text).toLowerCase();
  const lines = [];
  const focusGoal = s.goals[0];

  if (/stress|tired|overwhelm|anxious|sad|low/.test(q)) {
    lines.push(`${name ? `${name}, that` : "That"} sounds heavy. Let's make today lighter.`);
    lines.push("1. Pick just one small task you can finish in 15 minutes.");
    lines.push("2. Take a 10-minute walk or stretch break.");
    lines.push("3. Write three lines in your journal tonight about what went well.");
    lines.push("If you're struggling a lot, please reach out to someone you trust or a local helpline.");
    return lines.join("\n");
  }
  if (/on track|progress|how am i|week/.test(q)) {
    lines.push(`This week you completed **${s.done} of ${s.total} tasks** (${s.rate}%) and were active on ${s.activeDays} of the last 7 days.`);
    if (focusGoal) lines.push(`Your goal that needs the most love is **${focusGoal.title}** at ${focusGoal.progress}%.`);
    lines.push(s.rate >= 70 ? "That's a strong pace. Keep protecting your best hours for the hard tasks." : "To pick up the pace, plan 3 tasks each morning and finish the hardest one first.");
    return lines.join("\n\n");
  }
  if (/minute|quick|short|time/.test(q)) {
    const t = s.open[0];
    lines.push(t ? `Use it on **${t.title}**. Set a timer and do only that.` : focusGoal ? `Take one small step on **${focusGoal.title}**${focusGoal.next_milestone ? `: start on "${focusGoal.next_milestone}"` : ""}.` : "Write down the one thing that would make today a win, then start it.");
    lines.push("Tip: the Focus timer in Life helps you stay on one thing.");
    return lines.join("\n\n");
  }
  if (/goal|break|step|plan/.test(q) && focusGoal) {
    lines.push(`Let's break down **${focusGoal.title}**:`);
    lines.push(`1. ${focusGoal.next_milestone ? `Next milestone: ${focusGoal.next_milestone}` : "Define what done looks like in one sentence"}`);
    lines.push("2. List the 3 smallest actions that move it forward");
    lines.push("3. Put one of them on today's list and do it first");
    return lines.join("\n");
  }
  // Default: today's focus.
  lines.push(name ? `Here's your focus for today, ${name}:` : "Here's your focus for today:");
  const picks = s.open.slice(0, 3).map((t) => t.title);
  if (picks.length) picks.forEach((p, i) => lines.push(`${i + 1}. ${p}`));
  else if (focusGoal) lines.push(`1. Move **${focusGoal.title}** forward${focusGoal.next_milestone ? ` (${focusGoal.next_milestone})` : ""}`, "2. A 20-minute workout from the Workout section", "3. Check off your habits");
  else lines.push("1. Set your first goal in the Goals tab", "2. Add 3 tasks for today", "3. Try a 10-minute workout");
  lines.push("", `You've been active ${s.activeDays} of the last 7 days. One step at a time.`);
  return lines.join("\n");
}

export function builtinDayPlan(ctx) {
  const s = stats(ctx);
  const existing = new Set(s.today.map((t) => t.title.toLowerCase()));
  const tasks = [];
  for (const g of s.goals.slice(0, 2)) {
    const title = (g.next_milestone ? `Work on: ${g.next_milestone}` : `Next step on ${g.title}`).slice(0, 60);
    if (!existing.has(title.toLowerCase())) tasks.push({ title, goal_id: g.id, source: "custom", minutes: 45, time_of_day: "morning", why: `Moves "${g.title}" forward (${g.progress}% done).` });
  }
  tasks.push({ title: "20-minute workout", goal_id: null, source: "fitness", minutes: 20, time_of_day: "afternoon", why: "Movement keeps your energy and focus up." });
  tasks.push({ title: "Plan tomorrow in 5 minutes", goal_id: null, source: "custom", minutes: 5, time_of_day: "evening", why: "Planning the night before makes mornings easier." });
  if (s.lowMoods >= 2) tasks.push({ title: "10-minute walk without your phone", goal_id: null, source: "fitness", minutes: 10, time_of_day: "anytime", why: "Your recent moods suggest you could use a reset." });
  return {
    summary: s.goals.length ? `Focus on ${s.goals[0].title} first, then keep your body and evening routine on track.` : "Start simple: one meaningful task, some movement and a quick plan for tomorrow.",
    tasks: tasks.slice(0, 5)
  };
}

export function builtinReview(ctx) {
  const s = stats(ctx);
  const best = s.goals.length ? [...s.goals].sort((a, b) => b.progress - a.progress)[0] : null;
  return {
    headline: s.total ? `You completed ${s.done} of ${s.total} tasks this week (${s.rate}%) and showed up on ${s.activeDays} days.` : "A quiet week. The best time to start a streak is today.",
    wins: [
      s.done ? `Finished ${s.done} task${s.done === 1 ? "" : "s"}` : "You opened the app and looked at your week",
      best ? `${best.title} is at ${best.progress}%` : "Your plan is ready for your first goal"
    ],
    patterns: [
      s.activeDays < 4 ? "Several days had no completed tasks" : "You stayed consistent most days",
      s.lowMoods >= 2 ? "Your mood dipped a few times this week" : "Your mood looks steady"
    ],
    next_week: ["Plan 3 tasks each morning", s.goals[0] ? `Give ${s.goals[0].title} two focused sessions` : "Set one goal you care about", "Do at least 3 short workouts"]
  };
}
