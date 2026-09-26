CREATE TABLE IF NOT EXISTS chat_media (
  id text PRIMARY KEY,
  mime text NOT NULL,
  name text,
  size integer NOT NULL DEFAULT 0,
  data bytea NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS chat_threads (
  id text PRIMARY KEY,
  channel text NOT NULL CHECK (channel IN ('telegram_userbot', 'whatsapp')),
  peer_id text NOT NULL,
  peer_name text,
  peer_username text,
  peer_access_hash text,
  peer_type text,
  user_id text REFERENCES users(id) ON DELETE SET NULL,
  last_message_at timestamptz,
  last_message_preview text,
  last_direction text,
  unread_count integer NOT NULL DEFAULT 0,
  archived boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (channel, peer_id)
);
CREATE INDEX IF NOT EXISTS chat_threads_recent_idx ON chat_threads(last_message_at DESC NULLS LAST);

CREATE TABLE IF NOT EXISTS chat_messages (
  id text PRIMARY KEY,
  thread_id text NOT NULL REFERENCES chat_threads(id) ON DELETE CASCADE,
  direction text NOT NULL CHECK (direction IN ('in', 'out')),
  external_id text,
  kind text NOT NULL DEFAULT 'text' CHECK (kind IN ('text', 'image', 'audio', 'voice', 'video', 'file', 'sticker', 'system')),
  text text,
  media_id text REFERENCES chat_media(id) ON DELETE SET NULL,
  media_mime text,
  media_name text,
  media_size integer,
  provider_ref jsonb,
  sender_name text,
  status text NOT NULL DEFAULT 'sent' CHECK (status IN ('pending', 'sent', 'delivered', 'read', 'failed')),
  error text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS chat_messages_thread_idx ON chat_messages(thread_id, created_at);
CREATE UNIQUE INDEX IF NOT EXISTS chat_messages_ext_idx ON chat_messages(thread_id, external_id) WHERE external_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS chat_sync_state (
  channel text PRIMARY KEY,
  cursor text,
  running boolean NOT NULL DEFAULT false,
  synced_at timestamptz,
  detail text
);
