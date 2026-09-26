-- allow bot-linked Telegram threads in the workspace
ALTER TABLE chat_threads DROP CONSTRAINT IF EXISTS chat_threads_channel_check;
ALTER TABLE chat_threads ADD CONSTRAINT chat_threads_channel_check CHECK (channel IN ('telegram_userbot', 'telegram_bot', 'whatsapp'));

-- per-thread AI auto-reply override (NULL = use the global default)
ALTER TABLE chat_threads ADD COLUMN IF NOT EXISTS auto_reply boolean;

CREATE TABLE IF NOT EXISTS chat_polls (
  id text PRIMARY KEY,
  thread_id text NOT NULL REFERENCES chat_threads(id) ON DELETE CASCADE,
  message_id text REFERENCES chat_messages(id) ON DELETE SET NULL,
  channel text NOT NULL,
  external_id text,
  question text NOT NULL,
  options jsonb NOT NULL,
  created_by text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS chat_polls_thread_idx ON chat_polls(thread_id, created_at DESC);

CREATE TABLE IF NOT EXISTS chat_poll_votes (
  id text PRIMARY KEY,
  poll_id text NOT NULL REFERENCES chat_polls(id) ON DELETE CASCADE,
  voter text NOT NULL,
  option_index smallint,
  option_text text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (poll_id, voter)
);
