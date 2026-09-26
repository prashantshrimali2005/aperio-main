# Aperio API

All endpoints are under `/api/v1`. Protected endpoints require the Aperio session cookie. Every response is wrapped as:

```json
{ "success": true, "data": {} }
```

or:

```json
{ "success": false, "error": { "code": "VALIDATION_ERROR", "message": "..." } }
```

## Authentication

- `POST /auth/register` — `{ fullName, email, password }` creates a user, profile, preference row, and session.
- `POST /auth/login` — `{ email, password }` starts a session.
- `POST /auth/logout` — clears the current session.
- `GET /auth/google` — sets a short-lived state cookie and redirects to Google's consent screen. Returns a redirect to `/login?error=google_unavailable` when `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET` are unset.
- `GET /auth/google/callback` — Google returns here with `code` and `state`. Validates state, exchanges the code with the client secret, reads the verified profile, links by `google_id` or verified email or creates a new user, starts a session, and redirects to `/onboarding` (new) or `/overview`. Failures redirect to `/login?error=...`.

## Profile and reference data

- `GET /me` — current user and profile.
- `PATCH /me` — validated profile updates.
- `GET /roles` — active role catalog with the current user's latest match when available.
- `GET /roles/:id` — role plus level-specific requirements.
- `GET /skills` — skill catalog.
- `GET /profile/skills` — current user's inferred or corrected skills.
- `PATCH /profile/skills/:id` — `{ level, userVerified }` saves a user correction.

## Resumes and analysis

- `GET /resumes` — owned resume metadata and verification status; extracted text is never returned.
- `POST /resumes` — multipart field `file`; accepts PDF, DOCX, JPG, PNG, or WebP up to 5 MB. The route validates magic bytes, uses Gemini OCR/vision to reject non-resume documents, extracts structured evidence, and stores private metadata/text. A rejected document returns `NOT_A_RESUME`.
- `GET /analyses?limit=20&offset=0` — append-only history.
- `POST /analyses` — `{ roleId, experienceLevel, resumeId? }`; compares real profile/resume evidence and creates an analysis plus roadmap.
- `GET /analyses/:id` — owned report with evidence and skill results.
- `GET /history` — history alias.
- `GET /role-comparison?left=:analysisId&right=:analysisId` — compares two owned analyses.
- `GET /market?roleId=:id&level=junior|mid|senior&region=global` — returns `{ leverage, outlook }`. `leverage` is computed from the seeded catalog (per-skill `roleCount`, `criticalCount`, `leverageIndex` 0–100). `outlook` is `{ connected: false, ... }` until a job-postings source is ingested; when connected it returns latest `signals` and linear `projections` built only from real dated observations. Never returns fabricated demand numbers.

## Course plan

- `GET /learning-paths` — the user's active AI-tailored learning path with modules, or `null`.
- `POST /learning-paths` — `{ analysisId?, weeklyHours }`; builds a new path from the open gaps of the given (or latest) analysis, archiving any previous active path. `422 NO_GAPS` / `422 ANALYSIS_NOT_FOUND` when there is nothing to plan.
- `PATCH /learning-paths/modules/:id` — `{ status: "not_started" | "in_progress" | "completed" }`; updates a module owned through the user's path.

## Skill verification tests

- `POST /assessments` — `{ analysisId? }` builds an optional multiple-choice check (Gemini) on the skills of the given/latest analysis. `GET /assessments` returns the latest.
- `GET /assessments/:id` — the test; correct answers are withheld until it is submitted.
- `POST /assessments/:id/submit` — `{ answers: [{ questionId, answerIndex }] }`. Grades it, writes per-skill verified levels into `user_skills` (`source='assessment'`, only over non-user-verified rows), and re-runs the linked analysis so the score reflects the results. Returns `{ score, perSkill, newAnalysisId }`.

## Practice

- `GET /practice` — the user's practice sessions plus suggested skills from the latest analysis.
- `POST /practice` — `{ skillId, analysisId? }` generates a timeboxed drill set (Gemini; deterministic fallback).
- `PATCH /practice/:id` — `{ status }`.

## Courses (LMS)

- `GET /courses` — `{ recommended, enrolled }`. Recommendations are published courses whose `skill_ids` overlap the user's non-strong skills, ranked by overlap.
- `GET /courses/:id` — learner view with per-lesson progress.
- `POST /courses/:id/enroll` — enrol.
- `PATCH /courses/lessons/:id` — `{ status }`; rolls the enrolment to `completed` when every lesson is done.

## Messaging and notifications

- `GET /integrations` — linked channels, notification toggles, and which providers are configured.
- `POST /integrations/telegram/link` — issues a one-time link code + `t.me` deep link (30-min TTL).
- `DELETE /integrations/telegram` — unlink Telegram.
- `POST /integrations/telegram/webhook` — Telegram update sink; validates `x-telegram-bot-api-secret-token`, links the `chat_id` when it receives a valid code. Not user-facing.
- `POST /integrations/whatsapp/link` — `501 NOT_IMPLEMENTED` (provider not wired yet).
- `PATCH /notifications/preferences` — `{ notifyRoadmap?, notifyWeeklyDigest?, notifyAnalysis?, notifyInactivity? }`.
- `GET|POST /cron/notifications?job=all|roadmap|weekly|inactivity` — batch sender; requires `Authorization: Bearer $CRON_SECRET` (or `?secret=`). Called by Vercel Cron.

## Admin

All under `/admin`, require an admin session (`ADMIN_EMAILS`).

- `GET|PUT /admin/integrations/:key`, `POST /admin/integrations/:key/test` — encrypted credential store for Telegram, Telegram user bot, WhatsApp (Meta Cloud / Twilio), and job-postings APIs (JSearch, Adzuna, custom).
- `GET /admin/users`, `GET` per-user dossier via the page; `GET /admin/activity` — filterable event log.
- `GET|POST /admin/courses`, `GET|DELETE /admin/courses/:id` — LMS course + lesson CRUD.
- `GET|POST /admin/market/sources`, `DELETE /admin/market/sources/:id` — weighted job-market sources; each can link an integration key for API credentials.

## Roadmaps

- `GET /roadmaps?analysisId=:id` — latest owned roadmap or roadmap for a specific owned analysis.
- `PATCH /roadmaps/items/:id` — `{ status: "not_started" | "in_progress" | "completed" }`; updates only an item owned through the user's roadmap.

## Errors and security

Zod validates all request bodies, route IDs, enum values, pagination, and uploads. The API does not return SQL errors or private resume text. Analysis creation is throttled per user for a short interval to prevent accidental duplicate runs.

Gemini credentials are read only in server modules from `GEMINI_API_KEY` (or the local compatibility alias `GEMINI_KEY`). They are never returned by the API or bundled into browser code. Uploaded document content is treated as untrusted input so text inside a resume cannot override the extraction instructions.
