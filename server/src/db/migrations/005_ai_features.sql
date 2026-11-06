-- AI assistant: conversation history (encrypted, like the journal), cached weekly reviews and journal reflections.
CREATE TABLE ai_messages (
  id bigserial PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('user', 'assistant')),
  content_enc text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ai_messages_user_idx ON ai_messages (user_id, id DESC);

CREATE TABLE ai_reviews (
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  week_start date NOT NULL,
  data jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, week_start)
);

ALTER TABLE journal_entries ADD COLUMN reflection_enc text;
