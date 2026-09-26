ALTER TABLE messaging_channels ADD COLUMN IF NOT EXISTS via text NOT NULL DEFAULT 'bot';
ALTER TABLE messaging_channels DROP CONSTRAINT IF EXISTS messaging_channels_via_check;
ALTER TABLE messaging_channels ADD CONSTRAINT messaging_channels_via_check CHECK (via IN ('bot', 'userbot'));
ALTER TABLE messaging_channels ADD COLUMN IF NOT EXISTS peer_access_hash text;
