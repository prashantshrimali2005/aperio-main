-- Optional skill verification test taken after a résumé analysis.
CREATE TABLE IF NOT EXISTS skill_assessments (
  id text PRIMARY KEY,
  user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  analysis_id text REFERENCES analyses(id) ON DELETE SET NULL,
  role_id text REFERENCES roles(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'expired')),
  score smallint CHECK (score BETWEEN 0 AND 100),
  question_count smallint NOT NULL DEFAULT 0,
  generator text NOT NULL DEFAULT 'gemini',
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);
CREATE INDEX IF NOT EXISTS skill_assessments_user_idx ON skill_assessments(user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS skill_assessment_questions (
  id text PRIMARY KEY,
  assessment_id text NOT NULL REFERENCES skill_assessments(id) ON DELETE CASCADE,
  skill_id text NOT NULL REFERENCES skills(id) ON DELETE CASCADE,
  prompt text NOT NULL,
  options jsonb NOT NULL,
  correct_index smallint NOT NULL,
  answer_index smallint,
  position integer NOT NULL
);
CREATE INDEX IF NOT EXISTS skill_assessment_questions_idx ON skill_assessment_questions(assessment_id, position);

-- Per-skill result rows, feed back into user_skills.
CREATE TABLE IF NOT EXISTS skill_assessment_results (
  id text PRIMARY KEY,
  assessment_id text NOT NULL REFERENCES skill_assessments(id) ON DELETE CASCADE,
  skill_id text NOT NULL REFERENCES skills(id) ON DELETE CASCADE,
  correct smallint NOT NULL,
  total smallint NOT NULL,
  score smallint NOT NULL,
  level smallint NOT NULL,
  UNIQUE (assessment_id, skill_id)
);

-- Targeted practice for skills the user lacks.
CREATE TABLE IF NOT EXISTS practice_sessions (
  id text PRIMARY KEY,
  user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  skill_id text NOT NULL REFERENCES skills(id) ON DELETE CASCADE,
  analysis_id text REFERENCES analyses(id) ON DELETE SET NULL,
  title text NOT NULL,
  focus text NOT NULL,
  drills jsonb NOT NULL DEFAULT '[]'::jsonb,
  self_check text NOT NULL DEFAULT '',
  skill_type text NOT NULL DEFAULT 'technical',
  status text NOT NULL DEFAULT 'not_started' CHECK (status IN ('not_started', 'in_progress', 'completed')),
  generator text NOT NULL DEFAULT 'gemini',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS practice_sessions_user_idx ON practice_sessions(user_id, created_at DESC);

-- Admin-managed LMS.
CREATE TABLE IF NOT EXISTS courses (
  id text PRIMARY KEY,
  slug text NOT NULL UNIQUE,
  title text NOT NULL,
  summary text NOT NULL DEFAULT '',
  level text NOT NULL DEFAULT 'mid' CHECK (level IN ('junior', 'mid', 'senior', 'all')),
  skill_ids text[] NOT NULL DEFAULT '{}',
  track text NOT NULL DEFAULT 'technical' CHECK (track IN ('technical', 'soft', 'mixed')),
  published boolean NOT NULL DEFAULT false,
  created_by text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS course_lessons (
  id text PRIMARY KEY,
  course_id text NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  title text NOT NULL,
  kind text NOT NULL DEFAULT 'reading' CHECK (kind IN ('reading', 'exercise', 'video', 'quiz', 'project')),
  content text NOT NULL DEFAULT '',
  resource_url text,
  duration_min smallint,
  position integer NOT NULL
);
CREATE INDEX IF NOT EXISTS course_lessons_idx ON course_lessons(course_id, position);

CREATE TABLE IF NOT EXISTS course_enrollments (
  id text PRIMARY KEY,
  user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  course_id text NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'dropped')),
  source text NOT NULL DEFAULT 'self' CHECK (source IN ('self', 'recommended', 'assigned')),
  enrolled_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, course_id)
);
CREATE INDEX IF NOT EXISTS course_enrollments_user_idx ON course_enrollments(user_id);

CREATE TABLE IF NOT EXISTS lesson_progress (
  id text PRIMARY KEY,
  enrollment_id text NOT NULL REFERENCES course_enrollments(id) ON DELETE CASCADE,
  lesson_id text NOT NULL REFERENCES course_lessons(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'not_started' CHECK (status IN ('not_started', 'in_progress', 'completed')),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (enrollment_id, lesson_id)
);

-- Weighted job-market sources for the outlook / forecast.
CREATE TABLE IF NOT EXISTS market_sources (
  id text PRIMARY KEY,
  name text NOT NULL,
  kind text NOT NULL DEFAULT 'api' CHECK (kind IN ('api', 'agency', 'manual')),
  weight numeric(5,2) NOT NULL DEFAULT 1 CHECK (weight >= 0 AND weight <= 10),
  integration_key text,
  region text NOT NULL DEFAULT 'global',
  config jsonb NOT NULL DEFAULT '{}'::jsonb,
  enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE market_signals ADD COLUMN IF NOT EXISTS source_id text REFERENCES market_sources(id) ON DELETE SET NULL;
ALTER TABLE user_skills DROP CONSTRAINT IF EXISTS user_skills_source_check;
ALTER TABLE user_skills ADD CONSTRAINT user_skills_source_check CHECK (source IN ('resume', 'profile', 'analysis', 'manual', 'assessment'));
