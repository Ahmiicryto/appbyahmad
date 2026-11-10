-- Fitness: completed workouts (exercise details as JSON so the library can grow without migrations).
CREATE TABLE workout_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title text NOT NULL,
  duration_sec int NOT NULL CHECK (duration_sec BETWEEN 0 AND 6 * 3600),
  calories int NOT NULL DEFAULT 0 CHECK (calories BETWEEN 0 AND 5000),
  exercises jsonb NOT NULL DEFAULT '[]',
  day date NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX workout_logs_user_idx ON workout_logs (user_id, day DESC);

-- Habits: daily check-ins.
CREATE TABLE habits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title text NOT NULL,
  icon text NOT NULL DEFAULT 'check',
  tone text NOT NULL DEFAULT 'violet',
  archived boolean NOT NULL DEFAULT false,
  position int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX habits_user_idx ON habits (user_id, archived);
CREATE TABLE habit_checks (
  habit_id uuid NOT NULL REFERENCES habits(id) ON DELETE CASCADE,
  day date NOT NULL,
  PRIMARY KEY (habit_id, day)
);

-- Money: income and expenses, plus a monthly budget on the profile.
CREATE TABLE transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('income', 'expense')),
  amount_cents bigint NOT NULL CHECK (amount_cents > 0 AND amount_cents < 100000000000),
  category text NOT NULL,
  note text,
  day date NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX transactions_user_day_idx ON transactions (user_id, day DESC);
ALTER TABLE profiles ADD COLUMN monthly_budget_cents bigint CHECK (monthly_budget_cents IS NULL OR monthly_budget_cents >= 0);
