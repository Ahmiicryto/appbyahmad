// Fills a development database with fake users so the admin dashboard has something to show.
// Usage: npm run seed:demo
import { isProd } from "../src/config.js";
import { migrate } from "../src/db/migrate.js";
import { pool, query } from "../src/db/pool.js";
import { hashPassword } from "../src/lib/auth.js";

if (isProd) {
  console.error("Refusing to seed demo data in production.");
  process.exit(1);
}

await migrate();
const NAMES = ["Hamza", "Sara", "Ali", "Ayesha", "Omar", "Zainab", "Bilal", "Fatima", "Usman", "Hira", "Danish", "Mariam"];
const GOALS = [
  ["Lose 7 kg", "fitness"], ["Save $20,000", "money"], ["Start a business", "business"],
  ["Get a new job", "career"], ["Read 20 books", "learning"], ["Learn Spanish", "learning"]
];
const THEMES = ["male", "female", "neutral"];
const hash = await hashPassword("demo-password");
const rand = (n) => Math.floor(Math.random() * n);

for (let i = 0; i < 48; i++) {
  const daysAgo = rand(30);
  const gender = ["male", "female", "unspecified"][i % 3];
  const { rows } = await query(
    `INSERT INTO users (email, password_hash, plan, created_at, last_seen_at)
     VALUES ($1, $2, $3, now() - make_interval(days => $4), now() - make_interval(hours => $5))
     ON CONFLICT (email) DO NOTHING RETURNING id`,
    [`demo${i}@example.com`, hash, i % 5 === 0 ? "premium" : "free", daysAgo, rand(24 * daysAgo + 1)]
  );
  if (!rows[0]) continue;
  const id = rows[0].id;
  const onboarded = i % 6 !== 0;
  await query(
    `INSERT INTO profiles (user_id, name, gender, theme, occupation, onboarded_at)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [id, NAMES[i % NAMES.length], gender, THEMES[i % 3], "Designer", onboarded ? new Date() : null]
  );
  if (!onboarded) continue;
  const [title, category] = GOALS[i % GOALS.length];
  const g = await query(
    "INSERT INTO goals (user_id, title, category, progress, plan_source) VALUES ($1, $2, $3, $4, $5) RETURNING id",
    [id, title, category, rand(80), i % 2 ? "ai" : "template"]
  );
  for (let d = 0; d < 7; d++) {
    await query(
      `INSERT INTO tasks (user_id, goal_id, source, title, due_date, done_at)
       VALUES ($1, $2, 'goal', $3, current_date - $4::int, $5)`,
      [id, g.rows[0].id, `Step ${d + 1}`, d, Math.random() < 0.6 ? new Date() : null]
    );
  }
  if (i % 2) {
    await query(
      `INSERT INTO ai_usage (user_id, kind, model, input_tokens, output_tokens, created_at)
       VALUES ($1, 'goal_plan', 'claude-opus-5-5', $2, $3, now() - make_interval(days => $4))`,
      [id, 900 + rand(400), 700 + rand(600), rand(Math.max(1, daysAgo))]
    );
  }
}
console.log("Demo data ready. Demo users sign in with password: demo-password");
await pool.end();
