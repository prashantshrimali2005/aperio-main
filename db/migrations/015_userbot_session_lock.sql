-- Single-row lease that serialises every MTProto connection made with the
-- stored Telegram user-bot session. Two concurrent clients on the same session
-- make Telegram invalidate it ("Concurrent usage of the current session ...").
CREATE TABLE IF NOT EXISTS userbot_lock (
  id smallint PRIMARY KEY DEFAULT 1,
  holder text,
  acquired_at timestamptz,
  CONSTRAINT userbot_lock_single CHECK (id = 1)
);

INSERT INTO userbot_lock (id, holder, acquired_at)
VALUES (1, NULL, NULL)
ON CONFLICT (id) DO NOTHING;
