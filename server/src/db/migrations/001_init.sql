CREATE EXTENSION IF NOT EXISTS citext;

CREATE TABLE users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email citext NOT NULL UNIQUE,
  password_hash text NOT NULL,
  role text NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'admin')),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended')),
  plan text NOT NULL DEFAULT 'free' CHECK (plan IN ('free', 'premium')),
  plan_expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz
);

-- Personal memory: asked once during onboarding, reused by every module.
CREATE TABLE profiles (
  user_id uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  name text,
  gender text CHECK (gender IN ('male', 'female', 'unspecified')),
  theme text NOT NULL DEFAULT 'neutral' CHECK (theme IN ('male', 'female', 'neutral')),
  birth_date date,
  height_cm numeric(5,1),
  weight_kg numeric(5,1),
  occupation text,
  self_word text,
  aspiration text,
  units text NOT NULL DEFAULT 'metric' CHECK (units IN ('metric', 'imperial')),
  currency text NOT NULL DEFAULT 'USD',
  timezone text NOT NULL DEFAULT 'UTC',
  onboarded_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE goals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title text NOT NULL,
  category text NOT NULL DEFAULT 'personal'
    CHECK (category IN ('business', 'fitness', 'money', 'career', 'learning', 'personal')),
  current_situation text,
  target text,
  reason text,
  deadline date,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'completed', 'cancelled')),
  progress int NOT NULL DEFAULT 0 CHECK (progress BETWEEN 0 AND 100),
  notes text,
  plan_summary text,
  plan_source text CHECK (plan_source IN ('ai', 'template')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX goals_user_idx ON goals (user_id, status);

CREATE TABLE milestones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  goal_id uuid NOT NULL REFERENCES goals(id) ON DELETE CASCADE,
  position int NOT NULL,
  title text NOT NULL,
  due_date date,
  status text NOT NULL DEFAULT 'upcoming' CHECK (status IN ('upcoming', 'in_progress', 'done'))
);
CREATE INDEX milestones_goal_idx ON milestones (goal_id, position);

-- One task table for every module, so Today can merge them.
CREATE TABLE tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  goal_id uuid REFERENCES goals(id) ON DELETE CASCADE,
  source text NOT NULL DEFAULT 'custom' CHECK (source IN ('goal', 'fitness', 'money', 'career', 'custom')),
  title text NOT NULL,
  due_date date NOT NULL,
  due_time text,
  done_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX tasks_user_date_idx ON tasks (user_id, due_date);

CREATE TABLE journal_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  mood text CHECK (mood IN ('happy', 'good', 'neutral', 'sad', 'stressed')),
  body_enc text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX journal_user_idx ON journal_entries (user_id, created_at DESC);

CREATE TABLE ai_usage (
  id bigserial PRIMARY KEY,
  user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  kind text NOT NULL,
  model text NOT NULL,
  input_tokens int NOT NULL DEFAULT 0,
  output_tokens int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ai_usage_created_idx ON ai_usage (created_at);
CREATE INDEX ai_usage_user_idx ON ai_usage (user_id, created_at);

CREATE TABLE audit_log (
  id bigserial PRIMARY KEY,
  actor_id uuid REFERENCES users(id) ON DELETE SET NULL,
  action text NOT NULL,
  target_type text,
  target_id text,
  details jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX audit_created_idx ON audit_log (created_at DESC);
