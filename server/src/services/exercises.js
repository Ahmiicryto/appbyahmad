// Bodyweight exercise catalogue shared with the app (the app has the matching animations under the same ids).
// reps OR seconds is the default dose; met = metabolic equivalent for a rough calorie estimate.
export const EXERCISES = [
  { id: "jumping_jacks", name: "Jumping jacks", focus: ["cardio", "full"], seconds: 30, met: 8 },
  { id: "high_knees", name: "High knees", focus: ["cardio"], seconds: 30, met: 8 },
  { id: "mountain_climber", name: "Mountain climbers", focus: ["cardio", "core"], seconds: 30, met: 8 },
  { id: "burpee", name: "Burpees", focus: ["cardio", "full"], reps: 8, met: 9 },
  { id: "squat", name: "Squats", focus: ["legs", "full"], reps: 15, met: 5 },
  { id: "lunge", name: "Alternating lunges", focus: ["legs"], reps: 12, met: 5 },
  { id: "glute_bridge", name: "Glute bridges", focus: ["legs", "core"], reps: 15, met: 3.5 },
  { id: "wall_sit", name: "Wall sit", focus: ["legs"], seconds: 30, met: 4 },
  { id: "pushup", name: "Push-ups", focus: ["upper", "full"], reps: 10, met: 6 },
  { id: "knee_pushup", name: "Knee push-ups", focus: ["upper"], reps: 10, met: 4 },
  { id: "triceps_dip", name: "Chair dips", focus: ["upper"], reps: 10, met: 4.5 },
  { id: "superman", name: "Superman hold", focus: ["upper", "core"], reps: 12, met: 3.5 },
  { id: "plank", name: "Plank", focus: ["core", "full"], seconds: 30, met: 4 },
  { id: "side_plank", name: "Side plank", focus: ["core"], seconds: 20, met: 4 },
  { id: "crunch", name: "Crunches", focus: ["core"], reps: 15, met: 3.8 },
  { id: "bicycle_crunch", name: "Bicycle crunches", focus: ["core"], reps: 16, met: 4 },
  { id: "arm_circles", name: "Arm circles", focus: ["mobility", "upper"], seconds: 30, met: 2.5 },
  { id: "toe_touch", name: "Standing toe touch", focus: ["mobility", "legs"], seconds: 30, met: 2.5 }
];
export const EXERCISE_IDS = EXERCISES.map((e) => e.id);
export const byId = Object.fromEntries(EXERCISES.map((e) => [e.id, e]));
export const FOCUSES = ["full", "cardio", "legs", "upper", "core", "mobility"];
export const LEVELS = ["easy", "medium", "hard"];

// Built-in workout when AI is off or out of requests: warm-up, focus moves in rounds, cool-down.
export function templateWorkout({ minutes = 15, focus = "full", level = "medium" }) {
  const pool = EXERCISES.filter((e) => e.focus.includes(focus) && !e.focus.includes("mobility"));
  const picks = (pool.length >= 4 ? pool : EXERCISES.filter((e) => e.focus.includes("full") || e.focus.includes("core"))).slice(0, 5);
  const scale = { easy: 0.75, medium: 1, hard: 1.3 }[level] ?? 1;
  const rest = { easy: 30, medium: 20, hard: 15 }[level] ?? 20;
  const dose = (e) => (e.seconds ? { reps: null, seconds: Math.round((e.seconds * scale) / 5) * 5 } : { reps: Math.max(4, Math.round(e.reps * scale)), seconds: null });
  const blocks = [{ exercise_id: "arm_circles", reps: null, seconds: 30, rest_seconds: 10 }, { exercise_id: "jumping_jacks", reps: null, seconds: 30, rest_seconds: 15 }];
  const perRoundSec = picks.reduce((sum, e) => sum + (e.seconds ? e.seconds * scale : e.reps * 3 * scale) + rest, 0);
  const rounds = Math.max(1, Math.min(5, Math.round((minutes * 60 - 150) / Math.max(60, perRoundSec))));
  for (let r = 0; r < rounds; r++) for (const e of picks) blocks.push({ exercise_id: e.id, ...dose(e), rest_seconds: rest });
  blocks.push({ exercise_id: "toe_touch", reps: null, seconds: 30, rest_seconds: 0 });
  const names = { full: "Full body", cardio: "Cardio burn", legs: "Leg day", upper: "Upper body", core: "Core strength", mobility: "Mobility" };
  return {
    title: `${names[focus] ?? "Full body"} · ${minutes} min`,
    summary: `${rounds} round${rounds > 1 ? "s" : ""} of ${picks.length} moves with a warm-up and cool-down. No equipment needed.`,
    blocks
  };
}

// Rough kcal: MET × kg × hours (70 kg when weight is unknown).
export function estimateCalories(exercises, weightKg) {
  const kg = weightKg || 70;
  const total = exercises.reduce((sum, x) => {
    const e = byId[x.exercise_id];
    const sec = x.seconds ?? (x.reps ? x.reps * 3 : 0);
    return sum + (e ? e.met * kg * (sec / 3600) : 0);
  }, 0);
  return Math.round(total);
}
