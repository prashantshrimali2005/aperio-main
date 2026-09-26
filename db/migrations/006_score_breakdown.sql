ALTER TABLE analyses ADD COLUMN IF NOT EXISTS technical_score smallint CHECK (technical_score BETWEEN 0 AND 100);
ALTER TABLE analyses ADD COLUMN IF NOT EXISTS soft_score smallint CHECK (soft_score BETWEEN 0 AND 100);
ALTER TABLE analysis_skill_results ADD COLUMN IF NOT EXISTS evidence_basis text;
