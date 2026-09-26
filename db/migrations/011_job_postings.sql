CREATE TABLE IF NOT EXISTS job_postings (
  id text PRIMARY KEY,
  source_id text REFERENCES market_sources(id) ON DELETE SET NULL,
  source_name text NOT NULL DEFAULT '',
  external_id text NOT NULL UNIQUE,
  title text NOT NULL,
  company text,
  location text,
  remote boolean NOT NULL DEFAULT false,
  url text,
  description text NOT NULL DEFAULT '',
  tags text[] NOT NULL DEFAULT '{}',
  skill_ids text[] NOT NULL DEFAULT '{}',
  posted_at timestamptz,
  captured_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS job_postings_captured_idx ON job_postings(captured_at DESC);
CREATE INDEX IF NOT EXISTS job_postings_skills_idx ON job_postings USING GIN (skill_ids);
CREATE INDEX IF NOT EXISTS job_postings_remote_idx ON job_postings(remote);

INSERT INTO market_sources (id, name, kind, weight, integration_key, region, enabled, config)
VALUES ('src-arbeitnow-default', 'Arbeitnow', 'api', 1, 'jobs.arbeitnow', 'global', true, '{"pages":"8"}'::jsonb)
ON CONFLICT (id) DO NOTHING;

