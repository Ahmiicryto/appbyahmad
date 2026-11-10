-- Future Me: letters to your future self, readable only from the unlock date (encrypted like the journal).
CREATE TABLE future_letters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title text NOT NULL,
  body_enc text NOT NULL,
  unlock_on date NOT NULL,
  opened_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX future_letters_user_idx ON future_letters (user_id, unlock_on);
