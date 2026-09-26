-- The partial unique index (WHERE external_id IS NOT NULL) can't serve
-- `ON CONFLICT (thread_id, external_id)`. A plain unique index works because
-- Postgres treats NULLs as distinct, so outgoing rows (external_id NULL) never
-- collide while inbound rows still dedupe by their provider id.
DROP INDEX IF EXISTS chat_messages_ext_idx;
CREATE UNIQUE INDEX IF NOT EXISTS chat_messages_ext_idx ON chat_messages(thread_id, external_id);
