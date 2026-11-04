-- Stripe can deliver webhooks out of order: remember the newest event applied per subscription.
ALTER TABLE subscriptions ADD COLUMN last_event_at timestamptz;
