# Aperio

Aperio is an evidence-based AI skill-gap analyzer for career roles. It compares a user's resume and profile with role-specific requirements, explains the evidence behind each result, and generates a prioritized learning roadmap.

## Stack

- Next.js 16 App Router, React, TypeScript
- Tailwind CSS 4 and small shadcn-style primitives
- Neon PostgreSQL through `@neondatabase/serverless`
- Zod validation, secure HTTP-only sessions, bcrypt password hashing
- Gemini multimodal resume verification, OCR, evidence extraction, and personalized guidance
- Local PDF/DOCX extraction fallback with `unpdf` and `mammoth`

## Local setup

1. Install Node.js 20.9+ and npm.
2. Copy `.env.example` to `.env.local`; set `DATABASE_URL` to a Neon connection string and `GEMINI_API_KEY` to a server-side Gemini API key. `GEMINI_KEY` is also accepted locally as a compatibility alias. For Google sign-in, set `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` (see Authentication below).
3. Install dependencies with `npm install`.
4. Create tables and seed the role/skill reference catalog:

   `npm run db:setup`

5. Start the app:

   `npm run dev`

Open `http://localhost:3000`.

## Data and analysis architecture

Role and skill reference data lives in `roles`, `skills`, and `role_skill_requirements`. User-owned records live in profiles, resumes, analyses, analysis skill results, roadmaps, and roadmap items. Analysis is append-only: every run creates a separate report and roadmap.

Resume uploads are validated for size, MIME type, and file signature before Gemini sees them. Gemini then uses document vision/OCR to verify that the upload is genuinely a resume or CV, read scanned and image-based layouts, and extract structured evidence. Only sanitized metadata, structured parsing results, and extracted text are stored; raw files are not exposed through a public URL.

The career match remains deterministic: Aperio searches actual profile/resume evidence, compares it with stored role requirements, assigns transparent levels, and calculates a weighted score. Gemini cannot change the score or classifications; it converts those grounded results into a concise summary and personalized project-oriented roadmap. If career diagnostics are temporarily unavailable, deterministic guidance is used instead.

### Scoring engine

For each role requirement `lib/analyzer.ts` gathers evidence from four sources, in priority order, and keeps the strongest while merging corroborating quotes:

1. **User-verified level** (`user_skills.user_verified`) — authoritative, confidence 1.0.
2. **Gemini structured extraction** — the résumé's `parsed_data.skills[]` (per-skill `inferredLevel`, `confidence`, evidence quote, `lastUsedYear`), matched onto catalog skills by normalized name/alias. This is OCR/extraction, not scoring — the deterministic engine still does the maths. A skill last used 4+ years ago gets a mild confidence (not level) decay.
3. **Text inference** over résumé + profile + Gemini-extracted experience/project descriptions — behavioural action language for soft skills, tool/verb signals for technical, with a listed-inventory bump so a "Skills:" line counts as at least working level.
4. **Skill-graph propagation** (`lib/skill-graph.ts`) — a demonstrated skill lends capped, lower-confidence credit to related ones (PostgreSQL → SQL + data modeling, Next.js → React + JS, Kubernetes → Docker, …). Graph-implied credit never yields a "strong" classification.

The weighted score (`Σ min(level/target, 1)·weight ÷ Σ weight`, ×100) is reported three ways: **overall**, **technical**, and **professional/soft** (`analyses.technical_score` / `soft_score`). Soft-skill requirements carry deliberately lighter weight so they inform the picture without dominating the number, since résumés rarely state them explicitly. Missing evidence is always "not demonstrated", never "does not have it".

### Soft skills

The skill catalog carries `skill_type` (`technical` or `soft`). Soft skills (communication, collaboration, problem solving, ownership, leadership, mentoring, stakeholder management, adaptability, critical thinking, time management) are scored through the same weighted pipeline, but inference uses behavioural evidence — action language in the resume/profile such as "led a team", "collaborated across", "root-caused", "mentored" — instead of tool keywords. No matching evidence stays "not demonstrated"; it is never read as "the person lacks it".

### Market outlook

Two separated demand signals, neither of which changes a match score:

1. **In-catalog leverage** — computed only from seeded role/skill data: how many tracked roles need a skill and how often it is critical. Always available.
2. **Live market outlook** — reads the `market_signals` table, which stays empty until a real job-postings source is ingested with `npm run market:ingest` (implement `fetchObservations()` in `scripts/ingest-market.ts`). With no data Aperio reports "not connected" and shows no numbers. A forecast is a linear projection returned only when two or more real dated observations exist for a skill.

## Course plan (AI-tailored)

`/learning` turns the open gaps in a user's latest analysis into a personalized, week-by-week study plan: per-module objective, 1–8 concrete activities, one hands-on project, and a self-verifiable checkpoint, paced to a chosen weekly-hours budget. Gemini generates it against the grounded gap list (no invented course names, URLs, certifications, or promised outcomes); a deterministic plan is built from the same gaps when Gemini is unavailable. Module progress is tracked but, like the roadmap, is not treated as proof of mastery. Tables: `learning_paths`, `learning_path_modules`.

## Skill verification tests

After an analysis, `/history/:id` offers an optional multiple-choice check on that analysis's skills (Gemini-generated, technical + soft). Submitting it writes a verified level per skill into `user_skills` (`source='assessment'`, never over a user-verified row), which the scoring engine trusts above résumé inference, and re-runs the analysis so the score and course recommendations reflect the results. Tables: `skill_assessments`, `skill_assessment_questions`, `skill_assessment_results`.

## Practice (`/practice`)

Timeboxed drill sets for the skills a user lacks — hands-on reps for technical skills, real workplace actions for soft skills (Gemini, with a deterministic fallback). Suggestions come from the latest analysis; each session tracks not-started / in-progress / completed.

## LMS and course recommendations (`/courses`, admin `/admin/lms`)

Admins build courses (title, level, track, covered skill ids, lessons of kind reading/exercise/video/quiz/project) and publish them. Published courses are auto-recommended to each user by how many of their non-strong skills a course covers; users enrol and tick off lessons, and the enrolment rolls to *completed* when every lesson is done. Tables: `courses`, `course_lessons`, `course_enrollments`, `lesson_progress`.

## Admin area (`/admin`)

Email-gated by `ADMIN_EMAILS`. Overview KPIs + charts, searchable users with full per-user dossiers, a filterable activity log (`activity_events`), the LMS, weighted **job-market sources** (`market_sources` — each with a demand weight and an optional linked API credential; blended into the outlook and forecast), and an **Integrations** page that stores all third-party credentials **encrypted in the database** (`integration_settings`, AES-256-GCM via `APP_ENCRYPTION_KEY`) rather than in environment files — Telegram, WhatsApp (Meta Cloud / Twilio), and job-postings APIs (JSearch, Adzuna, custom).

## Messaging and automated updates

Users can link a channel in **Settings → Connected messaging** and receive automated messages: roadmap reminders, a weekly digest, analysis-ready updates, and an inactivity nudge — each toggle is per-user and off unless a channel is linked.

- **Email** — a welcome message on sign-up plus the same event notifications (analysis ready / résumé scored, weekly digest, roadmap and inactivity nudges). No linking: it goes to the account's own address whenever an email provider is configured and `preferences.notify_email` is on. Providers configured in Admin → Integrations: **SMTP** (nodemailer — Gmail/host/anything) or **Resend** (HTTP API). "Test connection" sends a real email to the admin.
- **Telegram** is implemented. Configure the bot token, @username and webhook secret in Admin → Integrations (or the `TELEGRAM_*` env vars as a fallback), then register the webhook to `POST /api/v1/integrations/telegram/webhook`. Linking uses a one-time code the user sends to the bot; only a Telegram `chat_id` is stored.
- **WhatsApp** is stubbed — the notification engine already routes by channel `platform`; enabling it means adding a provider (Meta Cloud API or Twilio), implementing the `whatsapp` branch in `lib/notifications.ts`, and a real opt-in flow.
- Scheduled sends run from `GET /api/v1/cron/notifications?job=all` (Vercel Cron in `vercel.json`, daily) guarded by `CRON_SECRET`. Every send is de-duplicated via `notification_log` (per day / ISO week / window), so a daily cron still yields one weekly digest.

## Authentication

Aperio uses email/password authentication with bcrypt-hashed passwords and random, SHA-256-hashed session tokens in an HTTP-only cookie. Route handlers call `requireUser()` and every user-owned query includes the authenticated user ID for ownership checks.

### Google sign-in

Optional and additive; email/password keeps working when it is not configured.

1. In Google Cloud Console create an OAuth 2.0 **Web application** client.
2. Authorized JavaScript origins: `https://<your-domain>` and `http://localhost:3000`.
3. Authorized redirect URIs: `https://<your-domain>/api/v1/auth/google/callback` and `http://localhost:3000/api/v1/auth/google/callback`.
4. Set `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, and (in production) `APP_ORIGIN` to the public origin with no trailing slash so the redirect URI is built to match the registered one.

The flow is a server-side authorization-code exchange: `GET /api/v1/auth/google` sets a signed state cookie and redirects to Google; `GET /api/v1/auth/google/callback` verifies the state, exchanges the code for tokens over TLS with the client secret, reads the verified profile from Google's userinfo endpoint, then links by `google_id`, links an existing account by verified email, or creates a new user. The client secret is server-only and never sent to the browser. Migration `003_google_oauth.sql` makes `users.password_hash` nullable and adds `google_id`, `avatar_url`, and `auth_provider`.

## API

See [docs/API.md](docs/API.md) for the mobile-ready `/api/v1` contract.

See [docs/ANALYSIS_ARCHITECTURE.md](docs/ANALYSIS_ARCHITECTURE.md) for the deterministic/AI boundary and the implementation review of the supplied algorithm suite.

## Validation and production checks

```bash
npm run typecheck
npm run lint
npm test
npm run build
```

The app is Vercel-compatible: set `DATABASE_URL`, `GEMINI_API_KEY`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, and `APP_ORIGIN` as encrypted Vercel environment variables, optionally set `GEMINI_MODEL` (the recommended stable default is `gemini-2.5-flash`), and deploy the repository. Aperio automatically retries supported stable Flash models when a configured model is unavailable or rejects the request. No credentials are committed. Never prefix these secrets with `NEXT_PUBLIC_`.

## AI handoff

Read [AI_COORDINATION.md](AI_COORDINATION.md) before resuming work from another agent. Run `npm run ai:handoff` before a limit-driven handoff; it writes a local `.ai/HANDOFF.md` snapshot for the next Codex or Claude session.
