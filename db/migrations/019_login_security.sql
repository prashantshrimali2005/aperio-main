-- Remembered sign-in devices, so a login from a new device/browser or a new
-- country can trigger a one-time security email. Fingerprint is a coarse hash of
-- os + browser + device type (see lib/request-context.ts) — the same laptop on a
-- new IP stays "known", a new phone or browser does not.
CREATE TABLE IF NOT EXISTS known_devices (
  id text PRIMARY KEY,
  user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  fingerprint text NOT NULL,
  label text,
  ip text,
  user_agent text,
  city text,
  region text,
  country text,
  isp text,
  first_seen_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  login_count integer NOT NULL DEFAULT 1
);
CREATE UNIQUE INDEX IF NOT EXISTS known_devices_user_fp_idx ON known_devices(user_id, fingerprint);
CREATE INDEX IF NOT EXISTS known_devices_user_idx ON known_devices(user_id, last_seen_at DESC);
