import "server-only";

import { randomUUID } from "node:crypto";
import { db, one, query } from "@/lib/db";
import type { ExperienceLevel, Importance } from "@/lib/types";

interface GapRow extends Record<string, unknown> {
  skillId: string;
  name: string;
  skillType: "technical" | "soft";
  classification: string;
  currentLevel: number;
  targetLevel: number;
  importance: Importance;
}

export interface LearningModule {
  id: string;
  weekStart: number;
  weekEnd: number;
  skillId: string | null;
  skillName: string | null;
  title: string;
  objective: string;
  activities: string[];
  project: string;
  checkpoint: string;
  status: "not_started" | "in_progress" | "completed";
  position: number;
}

export interface LearningPath {
  id: string;
  analysisId: string | null;
  roleId: string | null;
  roleTitle: string | null;
  title: string;
  summary: string;
  totalWeeks: number;
  weeklyHours: number;
  generator: string;
  createdAt: string;
  modules: LearningModule[];
}

const IMPORTANCE_ORDER: Record<Importance, number> = { critical: 0, high: 1, medium: 2, optional: 3 };

/** Deterministic fallback: 1-3 weeks per gap by how far it is from target, capped at 20 weeks. */
function fallbackPath(roleTitle: string, weeklyHours: number, gaps: GapRow[]) {
  let cursor = 1;
  const modules = gaps.slice(0, 12).map((gap, index) => {
    const distance = Math.max(1, gap.targetLevel - gap.currentLevel);
    const weeks = Math.min(3, Math.max(1, distance));
    const weekStart = cursor;
    const weekEnd = cursor + weeks - 1;
    cursor = weekEnd + 1;
    const soft = gap.skillType === "soft";
    return {
      weekStart,
      weekEnd,
      skillId: gap.skillId,
      title: `${gap.name}`,
      objective: soft
        ? `Demonstrate ${gap.name} at a level appropriate for the role by taking on real scope and reflecting on it.`
        : `Raise ${gap.name} from a working understanding to applied, review-ready capability.`,
      activities: soft
        ? [`Volunteer for a task that forces ${gap.name.toLowerCase()} (owning a decision, running a session, giving feedback).`, `Ask a peer or lead for specific feedback afterwards.`, `Write a short situation-action-result note you can retell in an interview.`]
        : [`Study the core concepts of ${gap.name} for ~${Math.round(weeklyHours * 0.4)}h/week.`, `Rebuild a small feature using ${gap.name} from scratch.`, `Get one code review on it and act on the feedback.`],
      project: soft
        ? `A one-page write-up of a real situation where you applied ${gap.name}, with the outcome.`
        : `A small but complete project that clearly exercises ${gap.name}, pushed to your profile.`,
      checkpoint: `You can explain ${gap.name} decisions out loud and point to your own example.`,
      status: "not_started" as const,
      position: index,
    };
  });
  return {
    title: `${roleTitle} readiness path`,
    summary: `A ${cursor - 1}-week plan built from your current gaps, ordered by role impact. Adjust the pace to your schedule; progress is tracked per module.`,
    totalWeeks: Math.max(1, cursor - 1),
    modules,
  };
}

async function resolveAnalysis(userId: string, analysisId?: string | null) {
  if (analysisId) {
    return one<{ id: string; roleId: string; roleTitle: string; experienceLevel: ExperienceLevel; overallScore: number } & Record<string, unknown>>(
      `SELECT a.id, a.role_id AS "roleId", r.title AS "roleTitle", a.experience_level AS "experienceLevel", a.overall_score AS "overallScore"
       FROM analyses a JOIN roles r ON r.id=a.role_id WHERE a.id=$1 AND a.user_id=$2`,
      [analysisId, userId],
    );
  }
  return one<{ id: string; roleId: string; roleTitle: string; experienceLevel: ExperienceLevel; overallScore: number } & Record<string, unknown>>(
    `SELECT a.id, a.role_id AS "roleId", r.title AS "roleTitle", a.experience_level AS "experienceLevel", a.overall_score AS "overallScore"
     FROM analyses a JOIN roles r ON r.id=a.role_id WHERE a.user_id=$1 ORDER BY a.created_at DESC LIMIT 1`,
    [userId],
  );
}

export async function createLearningPath(userId: string, analysisId: string | null | undefined, weeklyHours: number): Promise<LearningPath> {
  const analysis = await resolveAnalysis(userId, analysisId);
  if (!analysis) throw new Error("ANALYSIS_NOT_FOUND");

  const gaps = await query<GapRow>(
    `SELECT ar.skill_id AS "skillId", s.name, s.skill_type AS "skillType", ar.classification,
      ar.current_level AS "currentLevel", ar.target_level AS "targetLevel", ar.importance
     FROM analysis_skill_results ar JOIN skills s ON s.id=ar.skill_id
     WHERE ar.analysis_id=$1 AND ar.classification <> 'strong'`,
    [analysis.id],
  );
  if (!gaps.length) throw new Error("NO_GAPS");
  gaps.sort((a, b) => IMPORTANCE_ORDER[a.importance] - IMPORTANCE_ORDER[b.importance] || (b.targetLevel - b.currentLevel) - (a.targetLevel - a.currentLevel));

  let generator = "deterministic";
  let plan = fallbackPath(analysis.roleTitle, weeklyHours, gaps);

  const gemini = await import("@/lib/gemini");
  if (gemini.isGeminiConfigured()) {
    try {
      const ai = await gemini.generateLearningPath({
        roleTitle: analysis.roleTitle,
        experienceLevel: analysis.experienceLevel,
        weeklyHours,
        overallScore: analysis.overallScore,
        gaps: gaps.map((gap) => ({
          skillId: gap.skillId, name: gap.name, skillType: gap.skillType,
          classification: gap.classification, currentLevel: gap.currentLevel,
          targetLevel: gap.targetLevel, importance: gap.importance,
        })),
      });
      generator = "gemini";
      plan = {
        title: ai.title,
        summary: ai.summary,
        totalWeeks: ai.totalWeeks,
        modules: ai.modules
          .slice()
          .sort((a, b) => a.weekStart - b.weekStart)
          .map((module, index) => ({
            weekStart: module.weekStart,
            weekEnd: Math.max(module.weekStart, module.weekEnd),
            skillId: module.skillId,
            title: module.title,
            objective: module.objective,
            activities: module.activities,
            project: module.project,
            checkpoint: module.checkpoint,
            status: "not_started" as const,
            position: index,
          })),
      };
    } catch (error) {
      console.error("Gemini learning path unavailable; using deterministic plan", error instanceof Error ? error.message : "unknown error");
    }
  }

  const pathId = randomUUID();
  const clampedWeeks = Math.min(52, Math.max(1, plan.totalWeeks));
  const clampedHours = Math.min(40, Math.max(2, Math.round(weeklyHours)));
  const sql = db();
  await sql.transaction((tx) => [
    tx`UPDATE learning_paths SET status='archived' WHERE user_id=${userId} AND status='active'`,
    tx`INSERT INTO learning_paths (id,user_id,analysis_id,role_id,title,summary,total_weeks,weekly_hours,generator)
       VALUES (${pathId},${userId},${analysis.id},${analysis.roleId},${plan.title},${plan.summary},${clampedWeeks},${clampedHours},${generator})`,
    ...plan.modules.map((module) =>
      tx`INSERT INTO learning_path_modules
        (id,path_id,week_start,week_end,skill_id,title,objective,activities,project,checkpoint,status,position)
        VALUES (${randomUUID()},${pathId},${module.weekStart},${module.weekEnd},${module.skillId ?? null},
          ${module.title},${module.objective},${JSON.stringify(module.activities)}::jsonb,${module.project},
          ${module.checkpoint},'not_started',${module.position})`,
    ),
  ]);

  const created = await getLearningPath(userId, pathId);
  if (!created) throw new Error("LEARNING_PATH_CREATE_FAILED");
  return created;
}

export async function getLearningPath(userId: string, pathId?: string): Promise<LearningPath | null> {
  const path = await one<Record<string, unknown>>(
    pathId
      ? `SELECT lp.id, lp.analysis_id AS "analysisId", lp.role_id AS "roleId", r.title AS "roleTitle",
          lp.title, lp.summary, lp.total_weeks AS "totalWeeks", lp.weekly_hours AS "weeklyHours",
          lp.generator, lp.created_at AS "createdAt"
         FROM learning_paths lp LEFT JOIN roles r ON r.id=lp.role_id
         WHERE lp.user_id=$1 AND lp.id=$2`
      : `SELECT lp.id, lp.analysis_id AS "analysisId", lp.role_id AS "roleId", r.title AS "roleTitle",
          lp.title, lp.summary, lp.total_weeks AS "totalWeeks", lp.weekly_hours AS "weeklyHours",
          lp.generator, lp.created_at AS "createdAt"
         FROM learning_paths lp LEFT JOIN roles r ON r.id=lp.role_id
         WHERE lp.user_id=$1 AND lp.status='active'
         ORDER BY lp.created_at DESC LIMIT 1`,
    pathId ? [userId, pathId] : [userId],
  );
  if (!path) return null;
  const modules = await query<Record<string, unknown>>(
    `SELECT m.id, m.week_start AS "weekStart", m.week_end AS "weekEnd", m.skill_id AS "skillId",
      s.name AS "skillName", m.title, m.objective, m.activities, m.project, m.checkpoint, m.status, m.position
     FROM learning_path_modules m LEFT JOIN skills s ON s.id=m.skill_id
     WHERE m.path_id=$1 ORDER BY m.position`,
    [path.id],
  );
  return { ...(path as unknown as LearningPath), modules: modules as unknown as LearningModule[] };
}

export async function setModuleStatus(userId: string, moduleId: string, status: LearningModule["status"]) {
  const rows = await query<{ id: string; status: string }>(
    `UPDATE learning_path_modules m SET status=$1
     FROM learning_paths lp
     WHERE m.id=$2 AND lp.id=m.path_id AND lp.user_id=$3
     RETURNING m.id, m.status`,
    [status, moduleId, userId],
  );
  return rows[0] ?? null;
}
