CREATE TABLE IF NOT EXISTS users (
  id text PRIMARY KEY,
  email text NOT NULL UNIQUE,
  password_hash text NOT NULL,
  full_name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS sessions (
  id text PRIMARY KEY,
  user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS sessions_user_idx ON sessions(user_id);
CREATE INDEX IF NOT EXISTS sessions_expiry_idx ON sessions(expires_at);

CREATE TABLE IF NOT EXISTS roles (
  id text PRIMARY KEY,
  slug text NOT NULL UNIQUE,
  title text NOT NULL,
  description text NOT NULL,
  category text NOT NULL,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS skills (
  id text PRIMARY KEY,
  slug text NOT NULL UNIQUE,
  name text NOT NULL,
  category text NOT NULL,
  description text NOT NULL,
  aliases text[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS role_skill_requirements (
  id text PRIMARY KEY,
  role_id text NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  skill_id text NOT NULL REFERENCES skills(id) ON DELETE CASCADE,
  target_level smallint NOT NULL CHECK (target_level BETWEEN 0 AND 4),
  importance text NOT NULL CHECK (importance IN ('critical','high','medium','optional')),
  experience_level text NOT NULL CHECK (experience_level IN ('junior','mid','senior')),
  weight numeric(6,2) NOT NULL CHECK (weight > 0),
  UNIQUE(role_id, skill_id, experience_level)
);
CREATE INDEX IF NOT EXISTS role_skills_lookup_idx ON role_skill_requirements(role_id, experience_level);

CREATE TABLE IF NOT EXISTS profiles (
  user_id text PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  headline text,
  current_status text CHECK (current_status IN ('student','fresher','professional','career_switcher')),
  bio text,
  location text,
  years_experience numeric(4,1),
  target_role_id text REFERENCES roles(id) ON DELETE SET NULL,
  target_level text CHECK (target_level IN ('junior','mid','senior')),
  onboarding_completed boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS resumes (
  id text PRIMARY KEY,
  user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  filename text NOT NULL,
  mime_type text NOT NULL,
  file_size integer NOT NULL,
  extracted_text text NOT NULL,
  status text NOT NULL CHECK (status IN ('processed','failed')),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS resumes_user_idx ON resumes(user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS user_skills (
  id text PRIMARY KEY,
  user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  skill_id text NOT NULL REFERENCES skills(id) ON DELETE CASCADE,
  level smallint NOT NULL CHECK (level BETWEEN 0 AND 4),
  source text NOT NULL CHECK (source IN ('resume','profile','analysis','manual')),
  confidence numeric(4,3) NOT NULL CHECK (confidence BETWEEN 0 AND 1),
  evidence jsonb NOT NULL DEFAULT '[]'::jsonb,
  user_verified boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, skill_id)
);

CREATE TABLE IF NOT EXISTS analyses (
  id text PRIMARY KEY,
  user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role_id text NOT NULL REFERENCES roles(id),
  resume_id text REFERENCES resumes(id) ON DELETE SET NULL,
  experience_level text NOT NULL CHECK (experience_level IN ('junior','mid','senior')),
  overall_score smallint NOT NULL CHECK (overall_score BETWEEN 0 AND 100),
  summary text NOT NULL,
  matched_count integer NOT NULL,
  developing_count integer NOT NULL,
  missing_count integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS analyses_user_idx ON analyses(user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS analysis_skill_results (
  id text PRIMARY KEY,
  analysis_id text NOT NULL REFERENCES analyses(id) ON DELETE CASCADE,
  skill_id text NOT NULL REFERENCES skills(id),
  classification text NOT NULL CHECK (classification IN ('strong','developing','missing')),
  current_level smallint NOT NULL CHECK (current_level BETWEEN 0 AND 4),
  target_level smallint NOT NULL CHECK (target_level BETWEEN 0 AND 4),
  confidence numeric(4,3) NOT NULL CHECK (confidence BETWEEN 0 AND 1),
  importance text NOT NULL CHECK (importance IN ('critical','high','medium','optional')),
  evidence jsonb NOT NULL DEFAULT '[]'::jsonb,
  recommendation text NOT NULL,
  why_it_matters text NOT NULL,
  UNIQUE(analysis_id, skill_id)
);

CREATE TABLE IF NOT EXISTS roadmaps (
  id text PRIMARY KEY,
  user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  analysis_id text NOT NULL UNIQUE REFERENCES analyses(id) ON DELETE CASCADE,
  title text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS roadmap_items (
  id text PRIMARY KEY,
  roadmap_id text NOT NULL REFERENCES roadmaps(id) ON DELETE CASCADE,
  skill_id text NOT NULL REFERENCES skills(id),
  phase smallint NOT NULL CHECK (phase BETWEEN 1 AND 3),
  priority text NOT NULL CHECK (priority IN ('critical','high','medium','optional')),
  effort text NOT NULL,
  status text NOT NULL DEFAULT 'not_started' CHECK (status IN ('not_started','in_progress','completed')),
  recommended_action text NOT NULL,
  why_it_matters text NOT NULL,
  position integer NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS projects (
  id text PRIMARY KEY,
  user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text NOT NULL DEFAULT '',
  url text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS work_experience (
  id text PRIMARY KEY,
  user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  company text NOT NULL,
  title text NOT NULL,
  description text NOT NULL DEFAULT '',
  start_date date,
  end_date date,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS education (
  id text PRIMARY KEY,
  user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  institution text NOT NULL,
  qualification text NOT NULL,
  field text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS certifications (
  id text PRIMARY KEY,
  user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name text NOT NULL,
  issuer text,
  issued_at date,
  credential_url text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS preferences (
  user_id text PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  theme text NOT NULL DEFAULT 'system' CHECK (theme IN ('light','dark','system')),
  email_updates boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now()
);
