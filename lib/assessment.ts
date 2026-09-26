import "server-only";

import { randomUUID } from "node:crypto";
import { db, one, query } from "@/lib/db";
import type { ExperienceLevel } from "@/lib/types";

const PER_SKILL = 2;
const MAX_SKILLS = 6;

function levelFromScore(score: number) {
  if (score >= 85) return 4;
  if (score >= 65) return 3;
  if (score >= 40) return 2;
  return 1;
}

interface AnalysisRow {
  id: string;
  roleId: string;
  roleTitle: string;
  experienceLevel: ExperienceLevel;
}

async function resolveAnalysis(userId: string, analysisId?: string | null) {
  return one<AnalysisRow & Record<string, unknown>>(
    analysisId
      ? `SELECT a.id, a.role_id AS "roleId", r.title AS "roleTitle", a.experience_level AS "experienceLevel"
         FROM analyses a JOIN roles r ON r.id=a.role_id WHERE a.id=$1 AND a.user_id=$2`
      : `SELECT a.id, a.role_id AS "roleId", r.title AS "roleTitle", a.experience_level AS "experienceLevel"
         FROM analyses a JOIN roles r ON r.id=a.role_id WHERE a.user_id=$1 ORDER BY a.created_at DESC LIMIT 1`,
    analysisId ? [analysisId, userId] : [userId],
  );
}

export async function createAssessment(userId: string, analysisId?: string | null) {
  const analysis = await resolveAnalysis(userId, analysisId);
  if (!analysis) throw new Error("ANALYSIS_NOT_FOUND");

  // Prefer the developing/missing skills; fill up with the highest-weight ones.
  const skills = await query<{ skillId: string; name: string; skillType: "technical" | "soft"; targetLevel: number } & Record<string, unknown>>(
    `SELECT ar.skill_id AS "skillId", s.name, s.skill_type AS "skillType", ar.target_level AS "targetLevel"
     FROM analysis_skill_results ar JOIN skills s ON s.id=ar.skill_id
     WHERE ar.analysis_id=$1
     ORDER BY (ar.classification='strong'), (s.skill_type='soft'),
       CASE ar.importance WHEN 'critical' THEN 0 WHEN 'high' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END
     LIMIT $2`,
    [analysis.id, MAX_SKILLS],
  );
  if (!skills.length) throw new Error("NO_SKILLS");

  const gemini = await import("@/lib/gemini");
  if (!gemini.isGeminiConfigured()) throw new Error("AI_NOT_CONFIGURED");
  const generated = await gemini.generateAssessmentQuestions({
    roleTitle: analysis.roleTitle,
    experienceLevel: analysis.experienceLevel,
    perSkill: PER_SKILL,
    skills: skills.map((s) => ({ skillId: s.skillId, name: s.name, skillType: s.skillType, targetLevel: s.targetLevel })),
  });

  const allowed = new Set(skills.map((s) => s.skillId));
  const questions = generated.questions.filter((q) => allowed.has(q.skillId)).slice(0, MAX_SKILLS * PER_SKILL);
  if (!questions.length) throw new Error("NO_QUESTIONS");

  const assessmentId = randomUUID();
  const sql = db();
  await sql.transaction((tx) => [
    tx`INSERT INTO skill_assessments (id, user_id, analysis_id, role_id, status, question_count)
       VALUES (${assessmentId}, ${userId}, ${analysis.id}, ${analysis.roleId}, 'pending', ${questions.length})`,
    ...questions.map((q, index) =>
      tx`INSERT INTO skill_assessment_questions (id, assessment_id, skill_id, prompt, options, correct_index, position)
         VALUES (${randomUUID()}, ${assessmentId}, ${q.skillId}, ${q.prompt}, ${JSON.stringify(q.options)}::jsonb, ${q.correctIndex}, ${index})`,
    ),
  ]);

  return getAssessment(userId, assessmentId);
}

export async function getAssessment(userId: string, assessmentId: string) {
  const assessment = await one<Record<string, unknown>>(
    `SELECT a.id, a.status, a.score, a.question_count AS "questionCount", a.analysis_id AS "analysisId",
      a.created_at AS "createdAt", a.completed_at AS "completedAt", r.title AS "roleTitle"
     FROM skill_assessments a LEFT JOIN roles r ON r.id=a.role_id
     WHERE a.id=$1 AND a.user_id=$2`,
    [assessmentId, userId],
  );
  if (!assessment) return null;
  const done = assessment.status === "completed";
  const questions = await query<Record<string, unknown>>(
    `SELECT q.id, q.skill_id AS "skillId", s.name AS "skillName", s.skill_type AS "skillType",
      q.prompt, q.options, q.position, q.answer_index AS "answerIndex"
      ${done ? ", q.correct_index AS \"correctIndex\"" : ""}
     FROM skill_assessment_questions q JOIN skills s ON s.id=q.skill_id
     WHERE q.assessment_id=$1 ORDER BY q.position`,
    [assessmentId],
  );
  const results = done
    ? await query<Record<string, unknown>>(
        `SELECT ar.skill_id AS "skillId", s.name AS "skillName", ar.correct, ar.total, ar.score, ar.level
         FROM skill_assessment_results ar JOIN skills s ON s.id=ar.skill_id
         WHERE ar.assessment_id=$1 ORDER BY ar.score DESC`,
        [assessmentId],
      )
    : [];
  return { ...assessment, questions, results };
}

export async function submitAssessment(
  userId: string,
  assessmentId: string,
  answers: Array<{ questionId: string; answerIndex: number }>,
) {
  const assessment = await one<{ id: string; status: string; analysisId: string | null } & Record<string, unknown>>(
    `SELECT id, status, analysis_id AS "analysisId" FROM skill_assessments WHERE id=$1 AND user_id=$2`,
    [assessmentId, userId],
  );
  if (!assessment) throw new Error("NOT_FOUND");
  if (assessment.status === "completed") throw new Error("ALREADY_COMPLETED");

  const questions = await query<{ id: string; skillId: string; correctIndex: number } & Record<string, unknown>>(
    `SELECT id, skill_id AS "skillId", correct_index AS "correctIndex" FROM skill_assessment_questions WHERE assessment_id=$1`,
    [assessmentId],
  );
  const answerMap = new Map(answers.map((a) => [a.questionId, a.answerIndex]));
  const bySkill = new Map<string, { correct: number; total: number }>();
  let totalCorrect = 0;

  for (const q of questions) {
    const given = answerMap.get(q.id);
    const isCorrect = typeof given === "number" && given === q.correctIndex;
    if (isCorrect) totalCorrect += 1;
    const bucket = bySkill.get(q.skillId) ?? { correct: 0, total: 0 };
    bucket.total += 1;
    if (isCorrect) bucket.correct += 1;
    bySkill.set(q.skillId, bucket);
  }

  const overall = questions.length ? Math.round((totalCorrect / questions.length) * 100) : 0;
  const perSkill = [...bySkill.entries()].map(([skillId, { correct, total }]) => {
    const score = Math.round((correct / total) * 100);
    return { skillId, correct, total, score, level: levelFromScore(score) };
  });

  const sql = db();
  await sql.transaction((tx) => [
    ...questions.map((q) =>
      tx`UPDATE skill_assessment_questions SET answer_index=${answerMap.get(q.id) ?? null} WHERE id=${q.id}`,
    ),
    ...perSkill.map((r) =>
      tx`INSERT INTO skill_assessment_results (id, assessment_id, skill_id, correct, total, score, level)
         VALUES (${randomUUID()}, ${assessmentId}, ${r.skillId}, ${r.correct}, ${r.total}, ${r.score}, ${r.level})
         ON CONFLICT (assessment_id, skill_id) DO UPDATE SET correct=EXCLUDED.correct, total=EXCLUDED.total, score=EXCLUDED.score, level=EXCLUDED.level`,
    ),
    ...perSkill.map((r) =>
      tx`INSERT INTO user_skills (id, user_id, skill_id, level, source, confidence, evidence, user_verified)
         VALUES (${randomUUID()}, ${userId}, ${r.skillId}, ${r.level}, 'assessment', ${Math.min(0.95, 0.6 + (r.score / 100) * 0.35)},
           ${JSON.stringify([{ quote: `Scored ${r.score}% on a ${r.total}-question skills check.`, source: "Skills test" }])}::jsonb, false)
         ON CONFLICT (user_id, skill_id) DO UPDATE SET level=EXCLUDED.level, source='assessment', confidence=EXCLUDED.confidence,
           evidence=EXCLUDED.evidence, updated_at=now()
         WHERE user_skills.user_verified = false`,
    ),
    tx`UPDATE skill_assessments SET status='completed', score=${overall}, completed_at=now() WHERE id=${assessmentId}`,
  ]);

  // Close the loop: re-run the analysis so the score reflects the verified levels.
  let newAnalysisId: string | null = null;
  if (assessment.analysisId) {
    const source = await one<{ roleId: string; experienceLevel: ExperienceLevel; resumeId: string | null } & Record<string, unknown>>(
      `SELECT role_id AS "roleId", experience_level AS "experienceLevel", resume_id AS "resumeId" FROM analyses WHERE id=$1 AND user_id=$2`,
      [assessment.analysisId, userId],
    );
    if (source) {
      try {
        const { runAnalysis } = await import("@/lib/analyzer");
        const rerun = await runAnalysis(userId, source.roleId, source.experienceLevel, source.resumeId);
        newAnalysisId = rerun.id;
      } catch (error) {
        console.error("Post-assessment re-analysis failed", error instanceof Error ? error.message : "unknown error");
      }
    }
  }

  return { score: overall, perSkill, newAnalysisId };
}
