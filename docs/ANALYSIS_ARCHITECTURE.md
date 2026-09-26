# Aperio analysis architecture

## Source-of-truth boundary

Aperio deliberately separates deterministic scoring from generative guidance.

1. The database supplies role requirements, target levels, importance, and weights.
2. Verified resume/profile evidence supplies the user's current demonstrated levels.
3. `lib/analyzer.ts` classifies each skill and calculates the weighted match score.
4. Gemini receives only that grounded result and writes a concise interpretation and project-oriented recommendations.
5. Gemini cannot change the match score, classifications, evidence, or role requirements. If Gemini is unavailable, the deterministic analysis still produces a valid report.

This boundary prevents a model response from fabricating a higher score, changing historical data, or claiming evidence that is not present.

### Evidence gathering (`lib/analyzer.ts`)

Per requirement, evidence is taken from the strongest of: user-verified level → Gemini's structured `parsed_data.skills[]` extraction (matched by normalized name/alias; recency-decayed confidence) → text inference over résumé/profile/extracted experience → skill-graph propagation (`lib/skill-graph.ts`, capped credit, never "strong"). The weighted score is reported as overall / technical / soft; soft requirements are weighted light because résumés rarely state them. Consuming Gemini's per-skill extraction is OCR, not scoring — the deterministic engine still computes every level, classification, and number.

## Resume intelligence

The upload route performs layered validation:

- authenticated ownership context;
- 5 MB size limit and allow-listed MIME types;
- magic-byte validation to catch renamed file extensions;
- Gemini multimodal inspection for genuine resume/CV structure;
- prompt-injection isolation: document text is treated only as untrusted data;
- structured JSON validated again with Zod;
- a minimum confidence threshold before persistence.

PDF and image uploads use Gemini document vision directly. DOCX files are parsed locally and the extracted text is supplied as untrusted document content. Raw resume bytes are not published or stored in the current architecture.

## Review of the supplied algorithm suite

| Proposed engine | Decision | Reason |
| --- | --- | --- |
| Weighted role matching | Use now | It maps directly to stored `role_skill_requirements`, target levels, importance, and weights. |
| Declared proficiency + recency + assessment score | Use when data exists | The model is useful, but Aperio does not yet have a validated assessment engine or complete recency data. Treating absent values as real would create false precision. |
| Adjacent-role discovery | Partial now | Users can analyze and compare multiple roles. Automatic adjacent-role ranking should be added only after enough verified profile evidence exists. |
| Live market urgency | Structured, data-gated | `market_signals` + `lib/market.ts` are in place as a **separate timestamped signal** that never alters the evidence score. In-catalog leverage (roles-per-skill) is computed and shown now; live demand and forecasts stay dark until `scripts/ingest-market.ts` is pointed at a real job-postings source. No static demand numbers are displayed. |
| Soft-skill assessment | Use now | Soft skills are first-class in the catalog (`skill_type='soft'`) and scored through the weighted pipeline using behavioural-evidence inference. Absence is "not demonstrated", not a deficit claim. |
| Exact learning velocity/mastery date | Do not expose as a promise | Effort depends on prior knowledge, practice quality, and available time. Aperio uses qualitative effort labels and progress states instead. |
| Course/capstone monetization | Defer | Recommendations must optimize the user's skill gap, not a price or margin, until a transparent resource catalog exists. |

The next safe algorithm expansion is recency-aware scoring after adding explicit `last_used_at`, evidence provenance, and optional skill-assessment records. Market-demand weighting should remain a separate, timestamped signal rather than altering the historical evidence score.
