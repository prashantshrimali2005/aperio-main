# Aperio AI coordination

This file is the durable handoff contract for any coding agent working on Aperio. It is intentionally provider-neutral so Codex, Claude, or a human can resume from the same repository state.

## Handoff rule

If the current agent is nearing a context, usage, or execution limit, it must stop at a safe boundary, run `npm run ai:handoff`, and leave the generated `.ai/HANDOFF.md` in the working tree. The next agent must read this file, `AGENTS.md`, and `CLAUDE.md` before editing.

Codex cannot directly detect account usage exhaustion or launch Claude from a repository file. The supported fallback is an explicit runner, IDE action, or human handoff that starts Claude in this same checkout and tells it to follow this contract.

## Shared operating contract

- Preserve user changes and do not reset or discard unrelated work.
- Read the current handoff before repeating investigation.
- Prefer small, reviewable patches with `apply_patch`.
- Keep the Next.js App Router, TypeScript, Tailwind, Neon, and `DATABASE_URL` architecture intact.
- Never add fake career scores, fake resume evidence, fake history, or fake progress to production paths.
- Treat missing evidence as “not demonstrated,” never as proof that a user lacks a skill.
- Keep authentication, ownership checks, Zod validation, secure cookies, and private resume handling server-side.
- Keep `DATABASE_URL`, `GEMINI_API_KEY`/`GEMINI_KEY`, and all future provider credentials server-only; never add a `NEXT_PUBLIC_` secret.
- Run `npm run typecheck`, `npm run lint`, and `npm run build` before declaring completion.
- If a check is blocked by missing `DATABASE_URL`, report it clearly; do not fabricate a successful database check.

## Current product invariants

- User data is persisted in Neon PostgreSQL.
- Role and skill catalogs are seeded reference data; user analyses and progress are not seeded.
- Resume bytes are not exposed publicly. The current implementation stores sanitized metadata and extracted text; an object-storage adapter may be added later without changing the analysis API.
- Gemini verifies uploaded PDF/DOCX/image content as a real resume and produces structured OCR evidence. Deterministic role requirements remain the source of truth for match scores and classifications.
- Analysis records are append-only. A new analysis creates a new report and roadmap.
- User-corrected skill levels are marked `user_verified` and take precedence over later inference.
- API responses use `{ success: true, data }` or `{ success: false, error: { code, message } }`.

## Resume checklist for the next agent

1. Read `.ai/HANDOFF.md` if it exists.
2. Inspect `git status --short` and the changed files.
3. Re-run the smallest failing check first.
4. Verify the relevant route with a real persisted user if `DATABASE_URL` is available.
5. Update `.ai/HANDOFF.md` via `npm run ai:handoff` before stopping again.

## Safe handoff prompt

Paste this into the next agent:

> Resume the Aperio build in this checkout. Read `AGENTS.md`, `CLAUDE.md`, `AI_COORDINATION.md`, and `.ai/HANDOFF.md` if present. Preserve existing work, inspect the current failure or incomplete acceptance item, implement only the in-scope fix, then run the relevant typecheck, lint, test, and build checks. Do not create dummy user analytics or claim database verification without `DATABASE_URL`.
