CREATE TABLE IF NOT EXISTS messaging_channels (
  id text PRIMARY KEY,
  user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  platform text NOT NULL CHECK (platform IN ('telegram', 'whatsapp')),
  address text,
  handle text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'linked', 'disabled')),
  link_code text,
  link_code_expires_at timestamptz,
  verified_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, platform)
);
CREATE UNIQUE INDEX IF NOT EXISTS messaging_channels_link_code_idx ON messaging_channels(link_code) WHERE link_code IS NOT NULL;
CREATE INDEX IF NOT EXISTS messaging_channels_address_idx ON messaging_channels(platform, address);

ALTER TABLE preferences ADD COLUMN IF NOT EXISTS notify_roadmap boolean NOT NULL DEFAULT true;
ALTER TABLE preferences ADD COLUMN IF NOT EXISTS notify_weekly_digest boolean NOT NULL DEFAULT true;
ALTER TABLE preferences ADD COLUMN IF NOT EXISTS notify_analysis boolean NOT NULL DEFAULT true;
ALTER TABLE preferences ADD COLUMN IF NOT EXISTS notify_inactivity boolean NOT NULL DEFAULT true;

CREATE TABLE IF NOT EXISTS notification_log (
  id text PRIMARY KEY,
  user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  channel_id text REFERENCES messaging_channels(id) ON DELETE SET NULL,
  kind text NOT NULL,
  dedupe_key text NOT NULL UNIQUE,
  status text NOT NULL CHECK (status IN ('sent', 'failed', 'skipped')),
  detail text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS notification_log_user_idx ON notification_log(user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS learning_paths (
  id text PRIMARY KEY,
  user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  analysis_id text REFERENCES analyses(id) ON DELETE SET NULL,
  role_id text REFERENCES roles(id) ON DELETE SET NULL,
  title text NOT NULL,
  summary text NOT NULL,
  total_weeks smallint NOT NULL CHECK (total_weeks BETWEEN 1 AND 52),
  weekly_hours smallint NOT NULL CHECK (weekly_hours BETWEEN 1 AND 60),
  generator text NOT NULL DEFAULT 'gemini',
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived')),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS learning_paths_user_idx ON learning_paths(user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS learning_path_modules (
  id text PRIMARY KEY,
  path_id text NOT NULL REFERENCES learning_paths(id) ON DELETE CASCADE,
  week_start smallint NOT NULL,
  week_end smallint NOT NULL,
  skill_id text REFERENCES skills(id) ON DELETE SET NULL,
  title text NOT NULL,
  objective text NOT NULL,
  activities jsonb NOT NULL DEFAULT '[]'::jsonb,
  project text NOT NULL,
  checkpoint text NOT NULL,
  status text NOT NULL DEFAULT 'not_started' CHECK (status IN ('not_started', 'in_progress', 'completed')),
  position integer NOT NULL
);
CREATE INDEX IF NOT EXISTS learning_path_modules_path_idx ON learning_path_modules(path_id, position);
