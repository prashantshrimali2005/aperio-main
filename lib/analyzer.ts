import { randomUUID } from "node:crypto";
import { db, one, query } from "@/lib/db";
import { impliedSkillIds } from "@/lib/skill-graph";
import type { Classification, ExperienceLevel, Importance } from "@/lib/types";

type SkillType = "technical" | "soft";

interface RequirementRow extends Record<string, unknown> {
  skillId: string;
  name: string;
  category: string;
  description: string;
  aliases: string[];
  targetLevel: number;
  importance: Importance;
  weight: string;
  skillType: SkillType;
}

interface ExistingSkillRow extends Record<string, unknown> {
  skillId: string;
  level: number;
  confidence: string;
  source: string;
  evidence: Array<{ quote: string; source: string }>;
  userVerified: boolean;
}

interface GeminiSkill {
  name?: string;
  category?: string;
  evidence?: string;
  inferredLevel?: number;
  confidence?: number;
  lastUsedYear?: number;
}

interface ResumeRow extends Record<string, unknown> {
  id: string;
  extractedText: string;
  parsedData:
    | {
        candidateName?: string;
        summary?: string;
        professionalHeadline?: string;
        skills?: GeminiSkill[];
        experience?: Array<{ company?: string; title?: string; evidence?: string }>;
        projects?: Array<{ name?: string; description?: string; technologies?: string[] }>;
      }
    | null;
}

interface CareerDiagnostics {
  summary: string;
  confidenceNote: string;
  skillRecommendations: Array<{
    skillId: string;
    recommendation: string;
    whyItMatters: string;
    effort: string;
    phase: number;
  }>;
}

export interface ScoredSkill {
  id: string;
  skillId: string;
  name: string;
  category: string;
  description: string;
  classification: Classification;
  currentLevel: number;
  targetLevel: number;
  confidence: number;
  importance: Importance;
  weight: number;
  skillType: SkillType;
  evidence: Array<{ quote: string; source: string }>;
  evidenceBasis: string;
  recommendation: string;
  whyItMatters: string;
}

// --- text evidence ---------------------------------------------------------

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function sentenceEvidence(text: string, aliases: string[]) {
  const sentences = text.split(/(?<=[.!?\n•])\s+/).map((item) => item.trim()).filter(Boolean);
  const patterns = aliases
    .filter((alias) => alias.length > 1)
    .map((alias) => new RegExp(`(^|[^a-z0-9+])${escapeRegExp(alias.toLowerCase())}([^a-z0-9+]|$)`, "i"));
  return sentences.filter((sentence) => patterns.some((pattern) => pattern.test(sentence))).slice(0, 3);
}

export function inferSkill(text: string, aliases: string[]) {
  const evidence = sentenceEvidence(text, aliases);
  if (!evidence.length) return { level: 0, confidence: 0.2, evidence: [] as string[] };
  const combined = evidence.join(" ").toLowerCase();
  const advancedSignals = /\b(architected|led|mentored|scaled|optimized|owned|designed)\b/;
  const workingSignals = /\b(built|developed|implemented|deployed|created|integrated|maintained|shipped|used)\b/;
  const listedInventory = evidence.some((sentence) => (sentence.match(/,/g) || []).length >= 2);
  let level = advancedSignals.test(combined)
    ? Math.min(4, 2 + Math.min(evidence.length, 2))
    : workingSignals.test(combined) || evidence.length > 1
      ? 2
      : 1;
  if (listedInventory) level = Math.max(level, 2);
  const confidence = Math.min(
    0.96,
    0.6 + evidence.length * 0.1 + (advancedSignals.test(combined) ? 0.1 : 0) + (listedInventory ? 0.05 : 0),
  );
  return { level, confidence, evidence };
}

// Soft skills are demonstrated through behaviour described in the profile, not
// through tools. We only credit a level when the text actually contains matching
// action language; absence stays "not demonstrated", never "does not have it".
const softLeadershipSignals =
  /\b(led|managed|mentored|coached|line-managed|headed|spearheaded|chaired|founder|co-?founder|founded|tech lead|team lead|product owner|set the direction|drove consensus|influenced|facilitated|negotiated|presented to (leadership|executives|the board)|owned the (outcome|delivery|roadmap))\b/;
const softAppliedSignals =
  /\b(collaborated|coordinated|partnered|communicated|presented|documented|liaised|resolved|root[- ]caused|diagnosed|prioriti[sz]ed|estimated|onboarded|trained|gave feedback|reviewed|adapted|delivered|shipped|launched|automated|architected|integrated|end-to-end|took .{0,30} to (deployment|production|launch))\b/;

export function inferSoftSkill(text: string, aliases: string[]) {
  const evidence = sentenceEvidence(text, aliases);
  if (!evidence.length) return { level: 0, confidence: 0.2, evidence: [] as string[] };
  const combined = evidence.join(" ").toLowerCase();
  const hasLeadership = softLeadershipSignals.test(combined);
  const hasApplied = softAppliedSignals.test(combined);
  const level = hasLeadership
    ? Math.min(4, 3 + (evidence.length > 1 ? 1 : 0))
    : hasApplied || evidence.length > 1
      ? 2
      : 1;
  const confidence = Math.min(0.92, 0.5 + evidence.length * 0.1 + (hasLeadership ? 0.12 : hasApplied ? 0.06 : 0));
  return { level, confidence, evidence };
}

// --- Gemini structured extraction ---------------------------------------------

function normalizeToken(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "");
}

/** Map the résumé's Gemini-extracted skills onto catalog skill ids. */
function indexGeminiSkills(requirements: RequirementRow[], geminiSkills: GeminiSkill[]) {
  const tokenToIds = new Map<string, Set<string>>();
  for (const requirement of requirements) {
    for (const token of [requirement.name, ...requirement.aliases]) {
      const norm = normalizeToken(token);
      if (norm.length < 3) continue;
      if (!tokenToIds.has(norm)) tokenToIds.set(norm, new Set());
      tokenToIds.get(norm)!.add(requirement.skillId);
    }
  }

  const bySkillId = new Map<string, { level: number; confidence: number; evidence: string; lastUsedYear: number }>();
  const consider = (skillId: string, g: GeminiSkill) => {
    const level = Math.max(0, Math.min(4, Math.round(Number(g.inferredLevel ?? 0))));
    if (level <= 0) return;
    const confidence = Math.max(0, Math.min(1, Number(g.confidence ?? 0.6)));
    const current = bySkillId.get(skillId);
    if (!current || level > current.level || (level === current.level && confidence > current.confidence)) {
      bySkillId.set(skillId, {
        level,
        confidence,
        evidence: (g.evidence ?? "").slice(0, 360),
        lastUsedYear: Number(g.lastUsedYear ?? 0),
      });
    }
  };

  for (const g of geminiSkills) {
    if (!g?.name) continue;
    const gNorm = normalizeToken(g.name);
    if (!gNorm) continue;
    const direct = tokenToIds.get(gNorm);
    if (direct) {
      for (const id of direct) consider(id, g);
      continue;
    }
    for (const [token, ids] of tokenToIds) {
      if (token.length >= 4 && (gNorm.includes(token) || token.includes(gNorm))) {
        for (const id of ids) consider(id, g);
      }
    }
  }
  return bySkillId;
}

// --- classification & scoring ----------------------------------------------

export function classifySkill(currentLevel: number, targetLevel: number): Classification {
  if (currentLevel >= targetLevel) return "strong";
  if (currentLevel > 0) return "developing";
  return "missing";
}

export function calculateScore(skills: Array<Pick<ScoredSkill, "currentLevel" | "targetLevel" | "weight">>) {
  const possible = skills.reduce((sum, skill) => sum + skill.weight, 0);
  if (!possible) return 0;
  const achieved = skills.reduce(
    (sum, skill) => sum + Math.min(skill.currentLevel / Math.max(skill.targetLevel, 1), 1) * skill.weight,
    0,
  );
  return Math.round((achieved / possible) * 100);
}

function recommendation(name: string, current: number, target: number, skillType: SkillType = "technical") {
  if (skillType === "soft") {
    if (current === 0)
      return `Take a role where you visibly practise ${name} (own a small initiative, run a meeting, write the design doc), then capture the outcome and a concrete example on your profile.`;
    return `Move ${name} from level ${current} to ${target}: seek scope with more ambiguity or people, ask for feedback on it explicitly, and record one situation-action-result example you can talk through.`;
  }
  if (current === 0)
    return `Build a small, reviewable project that demonstrates ${name}, then add the outcome and evidence to your profile.`;
  return `Deepen ${name} from level ${current} to ${target} through applied practice, feedback, and one production-style example.`;
}

function makeSummary(roleTitle: string, skills: ScoredSkill[], technicalScore: number, softScore: number) {
  const strong = skills.filter((item) => item.classification === "strong").slice(0, 3).map((item) => item.name);
  const gaps = skills
    .filter((item) => item.classification !== "strong")
    .sort((a, b) => b.weight - a.weight)
    .slice(0, 4)
    .map((item) => item.name);
  const foundation = strong.length
    ? `Your current profile demonstrates a foundation in ${strong.join(", ")}.`
    : "Your profile does not yet clearly demonstrate the core requirements for this role.";
  const split = ` Technical readiness is around ${technicalScore}% and professional-skill readiness around ${softScore}%.`;
  const focus = gaps.length
    ? ` The highest-impact areas to strengthen for ${roleTitle} are ${gaps.join(", ")}.`
    : ` Your profile currently covers the assessed ${roleTitle} requirements well.`;
  return `${foundation}${split}${focus}`;
}

// --- main ----------------------------------------------------------------

interface EvidenceResult {
  level: number;
  confidence: number;
  evidence: Array<{ quote: string; source: string }>;
  basis: string;
  implied: boolean;
}

const CURRENT_YEAR = new Date().getUTCFullYear();

export async function runAnalysis(
  userId: string,
  roleId: string,
  experienceLevel: ExperienceLevel,
  resumeId?: string | null,
) {
  const role = await one<{ id: string; title: string } & Record<string, unknown>>(
    "SELECT id, title FROM roles WHERE id=$1 AND active=true",
    [roleId],
  );
  if (!role) throw new Error("ROLE_NOT_FOUND");

  let resumeText = "";
  let candidateName = "";
  let geminiSkills: GeminiSkill[] = [];

  const takeResume = (resume: ResumeRow) => {
    const parsed = resume.parsedData ?? {};
    const parts = [
      resume.extractedText,
      parsed.summary ?? "",
      parsed.professionalHeadline ?? "",
      ...(parsed.experience ?? []).map((item) => `${item.title ?? ""} ${item.company ?? ""}. ${item.evidence ?? ""}`),
      ...(parsed.projects ?? []).map((item) => `${item.name ?? ""}. ${item.description ?? ""} ${(item.technologies ?? []).join(", ")}`),
    ];
    resumeText = parts.filter(Boolean).join("\n").trim();
    candidateName = parsed.candidateName ?? "";
    geminiSkills = Array.isArray(parsed.skills) ? parsed.skills : [];
  };

  if (resumeId) {
    const resume = await one<ResumeRow>(
      `SELECT id, extracted_text AS "extractedText", parsed_data AS "parsedData"
       FROM resumes WHERE id=$1 AND user_id=$2 AND status='processed'`,
      [resumeId, userId],
    );
    if (!resume) throw new Error("RESUME_NOT_FOUND");
    takeResume(resume);
  } else {
    const resume = await one<ResumeRow>(
      `SELECT id, extracted_text AS "extractedText", parsed_data AS "parsedData"
       FROM resumes WHERE user_id=$1 AND status='processed' ORDER BY created_at DESC LIMIT 1`,
      [userId],
    );
    if (resume) {
      takeResume(resume);
      resumeId = resume.id;
    }
  }

  const profileParts = await query<{ text: string } & Record<string, unknown>>(
    `SELECT COALESCE(headline,'') || ' ' || COALESCE(bio,'') AS text FROM profiles WHERE user_id=$1
     UNION ALL SELECT COALESCE(name,'') || ' ' || COALESCE(description,'') FROM projects WHERE user_id=$1
     UNION ALL SELECT COALESCE(title,'') || ' ' || COALESCE(company,'') || ' ' || COALESCE(description,'') FROM work_experience WHERE user_id=$1
     UNION ALL SELECT COALESCE(name,'') || ' ' || COALESCE(issuer,'') FROM certifications WHERE user_id=$1`,
    [userId],
  );
  const sourceText = `${resumeText}\n${profileParts.map((part) => part.text).join("\n")}`.trim();
  if (!sourceText && !geminiSkills.length) throw new Error("PROFILE_EMPTY");

  const requirements = await query<RequirementRow>(
    `SELECT s.id AS "skillId", s.name, s.category, s.description, s.aliases, s.skill_type AS "skillType",
      r.target_level AS "targetLevel", r.importance, r.weight
     FROM role_skill_requirements r JOIN skills s ON s.id=r.skill_id
     WHERE r.role_id=$1 AND r.experience_level=$2 ORDER BY r.weight DESC, s.name`,
    [roleId, experienceLevel],
  );
  if (!requirements.length) throw new Error("ROLE_REQUIREMENTS_MISSING");

  const existing = await query<ExistingSkillRow>(
    `SELECT skill_id AS "skillId", level, confidence, source, evidence, user_verified AS "userVerified" FROM user_skills WHERE user_id=$1`,
    [userId],
  );
  const bySkill = new Map(existing.map((item) => [item.skillId, item]));
  const geminiBySkill = indexGeminiSkills(requirements, geminiSkills);

  // Pass 1: direct evidence — user-verified > Gemini structured extraction > text match.
  const direct = new Map<string, EvidenceResult>();
  for (const requirement of requirements) {
    const isSoft = requirement.skillType === "soft";
    const saved = bySkill.get(requirement.skillId);
    const gem = geminiBySkill.get(requirement.skillId);
    const txt = isSoft
      ? inferSoftSkill(sourceText, [requirement.name, ...requirement.aliases])
      : inferSkill(sourceText, [requirement.name, ...requirement.aliases]);

    if (saved?.userVerified) {
      direct.set(requirement.skillId, {
        level: saved.level,
        confidence: 1,
        evidence: saved.evidence?.length ? saved.evidence : [{ quote: "You confirmed this level.", source: "You verified this" }],
        basis: "You verified this level",
        implied: false,
      });
      continue;
    }

    const candidates: EvidenceResult[] = [];
    if (saved && saved.level > 0) {
      const fromAssessment = saved.source === "assessment";
      candidates.push({
        level: saved.level,
        confidence: Number(saved.confidence ?? 0.5),
        evidence: saved.evidence ?? [],
        basis: fromAssessment ? "Verified by a skills test" : "Saved from an earlier analysis",
        implied: false,
      });
    }
    if (gem) {
      let confidence = gem.confidence;
      if (gem.lastUsedYear > 2000 && CURRENT_YEAR - gem.lastUsedYear > 3) confidence *= 0.85;
      candidates.push({
        level: gem.level,
        confidence,
        evidence: gem.evidence ? [{ quote: gem.evidence, source: "Résumé · AI-extracted" }] : [],
        basis: "AI-extracted from your résumé",
        implied: false,
      });
    }
    if (txt.level > 0) {
      candidates.push({
        level: txt.level,
        confidence: txt.confidence,
        evidence: txt.evidence.map((quote) => ({
          quote: quote.slice(0, 360),
          source: resumeText.includes(quote) ? "Résumé text" : "Profile text",
        })),
        basis: "Matched in your résumé / profile text",
        implied: false,
      });
    }

    if (!candidates.length) {
      direct.set(requirement.skillId, { level: 0, confidence: 0.2, evidence: [], basis: "Not demonstrated in the current profile", implied: false });
      continue;
    }
    candidates.sort((a, b) => b.level - a.level || b.confidence - a.confidence);
    const best = candidates[0];
    // merge evidence from the other corroborating sources
    const mergedEvidence = [...best.evidence];
    for (const other of candidates.slice(1)) {
      for (const item of other.evidence) {
        if (mergedEvidence.length < 3 && !mergedEvidence.some((e) => e.quote === item.quote)) mergedEvidence.push(item);
      }
    }
    direct.set(requirement.skillId, { ...best, evidence: mergedEvidence, confidence: Math.min(0.98, best.confidence) });
  }

  // Pass 2: skill-graph propagation — a demonstrated skill lends capped credit to
  // related skills that have weaker direct evidence.
  const requirementIds = new Set(requirements.map((r) => r.skillId));
  for (const requirement of requirements) {
    const source = direct.get(requirement.skillId);
    if (!source || source.level < 2 || source.confidence < 0.45) continue;
    for (const impliedId of impliedSkillIds(requirement.skillId)) {
      if (!requirementIds.has(impliedId)) continue;
      const target = direct.get(impliedId)!;
      const candidateLevel = Math.max(1, Math.min(2, source.level - 1));
      if (candidateLevel > target.level) {
        direct.set(impliedId, {
          level: candidateLevel,
          confidence: Math.min(0.5, source.confidence * 0.8),
          evidence: [{ quote: `Inferred from demonstrated ${requirement.name}.`, source: "Related skill" }],
          basis: `Implied by demonstrated ${requirement.name}`,
          implied: true,
        });
      }
    }
  }

  const scored: ScoredSkill[] = requirements.map((requirement) => {
    const ev = direct.get(requirement.skillId)!;
    const classification =
      ev.implied && ev.level >= requirement.targetLevel ? "developing" : classifySkill(ev.level, requirement.targetLevel);
    return {
      id: randomUUID(),
      skillId: requirement.skillId,
      name: requirement.name,
      category: requirement.category,
      description: requirement.description,
      currentLevel: ev.level,
      targetLevel: requirement.targetLevel,
      confidence: Number(ev.confidence.toFixed(3)),
      importance: requirement.importance,
      weight: Number(requirement.weight),
      skillType: requirement.skillType,
      classification,
      evidence: ev.evidence,
      evidenceBasis: ev.basis,
      recommendation: recommendation(requirement.name, ev.level, requirement.targetLevel, requirement.skillType),
      whyItMatters: requirement.description,
    };
  });

  const technicalScore = calculateScore(scored.filter((item) => item.skillType === "technical"));
  const softScore = calculateScore(scored.filter((item) => item.skillType === "soft"));
  const score = calculateScore(scored);
  const matched = scored.filter((item) => item.classification === "strong").length;
  const developing = scored.filter((item) => item.classification === "developing").length;
  const missing = scored.filter((item) => item.classification === "missing").length;
  const analysisId = randomUUID();
  const roadmapId = randomUUID();
  let summary = makeSummary(role.title, scored, technicalScore, softScore);
  let diagnostics: CareerDiagnostics | null = null;
  const gemini = await import("@/lib/gemini");
  if (gemini.isGeminiConfigured()) {
    try {
      diagnostics = await gemini.generateCareerDiagnostics({
        candidateName,
        roleTitle: role.title,
        experienceLevel,
        overallScore: score,
        skills: scored.map((item) => ({
          skillId: item.skillId,
          name: item.name,
          category: item.category,
          skillType: item.skillType,
          classification: item.classification,
          currentLevel: item.currentLevel,
          targetLevel: item.targetLevel,
          importance: item.importance,
          evidence: item.evidence,
        })),
      });
      summary = `${diagnostics.summary} ${diagnostics.confidenceNote}`.trim();
    } catch (error) {
      console.error(
        "Gemini career diagnostics were unavailable; using deterministic guidance",
        error instanceof Error ? error.message : "unknown error",
      );
    }
  }

  const guidanceBySkill = new Map(diagnostics?.skillRecommendations.map((item) => [item.skillId, item]) ?? []);
  for (const item of scored) {
    const guidance = guidanceBySkill.get(item.skillId);
    if (!guidance) continue;
    item.recommendation = guidance.recommendation;
    item.whyItMatters = guidance.whyItMatters;
  }
  const roadmapSkills = scored
    .filter((item) => item.classification !== "strong")
    .sort((a, b) => b.weight - a.weight)
    .slice(0, 9);

  const sql = db();
  await sql.transaction((tx) => [
    tx`INSERT INTO analyses (id,user_id,role_id,resume_id,experience_level,overall_score,technical_score,soft_score,summary,matched_count,developing_count,missing_count)
       VALUES (${analysisId},${userId},${roleId},${resumeId ?? null},${experienceLevel},${score},${technicalScore},${softScore},${summary},${matched},${developing},${missing})`,
    ...scored.map(
      (item) => tx`INSERT INTO analysis_skill_results
      (id,analysis_id,skill_id,classification,current_level,target_level,confidence,importance,evidence,evidence_basis,recommendation,why_it_matters)
      VALUES (${item.id},${analysisId},${item.skillId},${item.classification},${item.currentLevel},${item.targetLevel},${item.confidence},${item.importance},${JSON.stringify(item.evidence)}::jsonb,${item.evidenceBasis},${item.recommendation},${item.whyItMatters})`,
    ),
    tx`INSERT INTO roadmaps (id,user_id,analysis_id,title) VALUES (${roadmapId},${userId},${analysisId},${`${role.title} readiness roadmap`})`,
    ...roadmapSkills.map((item, index) => {
      const guidance = guidanceBySkill.get(item.skillId);
      return tx`INSERT INTO roadmap_items
      (id,roadmap_id,skill_id,phase,priority,effort,status,recommended_action,why_it_matters,position)
      VALUES (${randomUUID()},${roadmapId},${item.skillId},${guidance?.phase ?? Math.min(3, Math.floor(index / 3) + 1)},${item.importance},${guidance?.effort ?? (item.currentLevel === 0 ? "Focused foundation" : "Applied practice")},'not_started',${item.recommendation},${item.whyItMatters},${index})`;
    }),
    tx`UPDATE profiles SET target_role_id=${roleId}, target_level=${experienceLevel}, onboarding_completed=true, updated_at=now() WHERE user_id=${userId}`,
  ]);

  return {
    id: analysisId,
    overallScore: score,
    technicalScore,
    softScore,
    matchedCount: matched,
    developingCount: developing,
    missingCount: missing,
    summary,
  };
}
