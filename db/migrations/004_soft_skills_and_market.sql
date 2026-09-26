ALTER TABLE skills ADD COLUMN IF NOT EXISTS skill_type text NOT NULL DEFAULT 'technical';
ALTER TABLE skills DROP CONSTRAINT IF EXISTS skills_skill_type_check;
ALTER TABLE skills ADD CONSTRAINT skills_skill_type_check CHECK (skill_type IN ('technical', 'soft'));
CREATE INDEX IF NOT EXISTS skills_type_idx ON skills(skill_type);

CREATE TABLE IF NOT EXISTS market_signals (
  id text PRIMARY KEY,
  skill_id text NOT NULL REFERENCES skills(id) ON DELETE CASCADE,
  region text NOT NULL DEFAULT 'global',
  demand_index numeric(5,2) CHECK (demand_index BETWEEN 0 AND 100),
  posting_count integer CHECK (posting_count >= 0),
  trend text NOT NULL DEFAULT 'unknown' CHECK (trend IN ('rising', 'steady', 'declining', 'unknown')),
  yoy_change numeric(6,2),
  horizon_days integer CHECK (horizon_days > 0),
  source text NOT NULL,
  captured_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS market_signals_skill_idx ON market_signals(skill_id, region, captured_at DESC);
