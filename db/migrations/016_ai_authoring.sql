-- Gemini-authored practice question sets, managed from the admin side and
-- taken by users on the practice page. Courses reuse the existing courses /
-- course_lessons tables (they are only generated instead of hand-typed).

CREATE TABLE IF NOT EXISTS question_sets (
  id text PRIMARY KEY,
  title text NOT NULL,
  niche text NOT NULL DEFAULT 'General',
  topic text NOT NULL,
  level text NOT NULL DEFAULT 'mid' CHECK (level IN ('junior', 'mid', 'senior', 'all')),
  skill_id text REFERENCES skills(id) ON DELETE SET NULL,
  description text NOT NULL DEFAULT '',
  question_count smallint NOT NULL DEFAULT 0,
  published boolean NOT NULL DEFAULT true,
  generator text NOT NULL DEFAULT 'gemini',
  created_by text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS question_sets_niche_idx ON question_sets(niche, created_at DESC);

CREATE TABLE IF NOT EXISTS question_set_items (
  id text PRIMARY KEY,
  set_id text NOT NULL REFERENCES question_sets(id) ON DELETE CASCADE,
  prompt text NOT NULL,
  options jsonb NOT NULL,
  correct_index smallint NOT NULL,
  explanation text NOT NULL DEFAULT '',
  position integer NOT NULL
);
CREATE INDEX IF NOT EXISTS question_set_items_idx ON question_set_items(set_id, position);

CREATE TABLE IF NOT EXISTS question_set_attempts (
  id text PRIMARY KEY,
  user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  set_id text NOT NULL REFERENCES question_sets(id) ON DELETE CASCADE,
  score smallint NOT NULL CHECK (score BETWEEN 0 AND 100),
  correct smallint NOT NULL,
  total smallint NOT NULL,
  answers jsonb NOT NULL DEFAULT '[]'::jsonb,
  completed_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS question_set_attempts_idx ON question_set_attempts(user_id, completed_at DESC);
CREATE INDEX IF NOT EXISTS question_set_attempts_set_idx ON question_set_attempts(set_id);
