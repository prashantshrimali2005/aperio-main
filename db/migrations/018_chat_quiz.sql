-- Conversational practice tests over WhatsApp / Telegram: pick a set, then
-- answer each question by tapping an option, then get a score.
CREATE TABLE IF NOT EXISTS chat_quiz_sessions (
  id text PRIMARY KEY,
  thread_id text NOT NULL REFERENCES chat_threads(id) ON DELETE CASCADE,
  user_id text REFERENCES users(id) ON DELETE SET NULL,
  set_id text REFERENCES question_sets(id) ON DELETE SET NULL,
  stage text NOT NULL DEFAULT 'choosing_set' CHECK (stage IN ('choosing_set', 'in_progress', 'done', 'abandoned')),
  question_ids jsonb NOT NULL DEFAULT '[]'::jsonb,
  current_index smallint NOT NULL DEFAULT 0,
  correct smallint NOT NULL DEFAULT 0,
  answers jsonb NOT NULL DEFAULT '[]'::jsonb,
  pending_kind text,
  pending_ref text,
  pending_meta jsonb,
  started_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz
);
CREATE INDEX IF NOT EXISTS chat_quiz_sessions_thread_idx ON chat_quiz_sessions(thread_id, stage);
CREATE INDEX IF NOT EXISTS chat_quiz_sessions_pending_idx ON chat_quiz_sessions(pending_ref) WHERE pending_ref IS NOT NULL;

-- Every question already shown in this thread, so it is never repeated.
CREATE TABLE IF NOT EXISTS chat_quiz_seen (
  thread_id text NOT NULL REFERENCES chat_threads(id) ON DELETE CASCADE,
  item_id text NOT NULL REFERENCES question_set_items(id) ON DELETE CASCADE,
  seen_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (thread_id, item_id)
);
