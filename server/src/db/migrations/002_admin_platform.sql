-- Admin platform: live settings, pricing plans + Stripe, activity, error logs, notifications, push.

-- Live, admin-editable settings. Secret values are encrypted (value = {"enc": "v1:..."}).
CREATE TABLE settings (
  key text PRIMARY KEY,
  value jsonb NOT NULL,
  secret boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE plans (
  id text PRIMARY KEY CHECK (id ~ '^[a-z0-9_-]{2,40}$'),
  name text NOT NULL,
  description text,
  price_cents int NOT NULL CHECK (price_cents >= 0),
  currency text NOT NULL DEFAULT 'usd',
  interval text NOT NULL CHECK (interval IN ('month', 'year')),
  trial_days int NOT NULL DEFAULT 0 CHECK (trial_days BETWEEN 0 AND 90),
  features jsonb NOT NULL DEFAULT '[]',
  stripe_price_id text,
  active boolean NOT NULL DEFAULT true,
  sort int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO plans (id, name, description, price_cents, interval, trial_days, features, sort) VALUES
  ('premium_monthly', 'Premium Monthly', 'Billed every month', 1299, 'month', 7,
   '["Unlimited goals","Adaptive plans","Full Money, Fitness and Nutrition","Career, Future Me and Decisions","Weekly and monthly reviews","No ads"]', 1),
  ('premium_yearly', 'Premium Yearly', 'Save 42% vs monthly', 8999, 'year', 7,
   '["Everything in Monthly","2 months free"]', 0);

ALTER TABLE users ADD COLUMN stripe_customer_id text UNIQUE;

CREATE TABLE subscriptions (
  id bigserial PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  plan_id text REFERENCES plans(id) ON DELETE SET NULL,
  provider text NOT NULL DEFAULT 'stripe' CHECK (provider IN ('stripe', 'manual', 'apple', 'google')),
  provider_subscription_id text UNIQUE,
  status text NOT NULL,
  amount_cents int,
  currency text,
  current_period_end timestamptz,
  cancel_at_period_end boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX subscriptions_user_idx ON subscriptions (user_id);

CREATE TABLE payments (
  id bigserial PRIMARY KEY,
  user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  provider text NOT NULL DEFAULT 'stripe',
  provider_payment_id text UNIQUE,
  amount_cents int NOT NULL,
  currency text NOT NULL,
  status text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX payments_created_idx ON payments (created_at);

-- Processed Stripe webhook events, so retries are not applied twice.
CREATE TABLE webhook_events (
  id text PRIMARY KEY,
  type text NOT NULL,
  received_at timestamptz NOT NULL DEFAULT now()
);

-- What users do (never content: no journal text, no goal titles in meta).
CREATE TABLE activity_events (
  id bigserial PRIMARY KEY,
  user_id uuid REFERENCES users(id) ON DELETE CASCADE,
  type text NOT NULL,
  meta jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX activity_created_idx ON activity_events (created_at DESC);
CREATE INDEX activity_user_idx ON activity_events (user_id, created_at DESC);
CREATE INDEX activity_type_idx ON activity_events (type, created_at DESC);

CREATE TABLE error_logs (
  id bigserial PRIMARY KEY,
  source text NOT NULL CHECK (source IN ('server', 'app', 'admin')),
  level text NOT NULL DEFAULT 'error' CHECK (level IN ('error', 'warn', 'fatal')),
  message text NOT NULL,
  stack text,
  path text,
  user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  meta jsonb NOT NULL DEFAULT '{}',
  fingerprint text NOT NULL,
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX error_logs_created_idx ON error_logs (created_at DESC);
CREATE INDEX error_logs_fingerprint_idx ON error_logs (fingerprint, created_at DESC);

-- In-app inbox. One row per recipient.
CREATE TABLE notifications (
  id bigserial PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  campaign_id bigint,
  kind text NOT NULL DEFAULT 'message',
  title text NOT NULL,
  body text NOT NULL,
  data jsonb NOT NULL DEFAULT '{}',
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX notifications_user_idx ON notifications (user_id, created_at DESC);

CREATE TABLE push_tokens (
  id bigserial PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token text NOT NULL UNIQUE,
  platform text CHECK (platform IN ('ios', 'android', 'web')),
  created_at timestamptz NOT NULL DEFAULT now(),
  last_used_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX push_tokens_user_idx ON push_tokens (user_id);

-- Notification preferences per user (defaults: everything on).
ALTER TABLE profiles ADD COLUMN notification_prefs jsonb NOT NULL DEFAULT '{"push": true, "reminders": true, "announcements": true}';

CREATE TABLE notification_campaigns (
  id bigserial PRIMARY KEY,
  title text NOT NULL,
  body text NOT NULL,
  data jsonb NOT NULL DEFAULT '{}',
  audience jsonb NOT NULL,
  send_push boolean NOT NULL DEFAULT true,
  status text NOT NULL DEFAULT 'sent' CHECK (status IN ('sending', 'sent', 'failed')),
  recipients int NOT NULL DEFAULT 0,
  push_sent int NOT NULL DEFAULT 0,
  push_failed int NOT NULL DEFAULT 0,
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
