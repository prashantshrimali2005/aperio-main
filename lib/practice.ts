import "server-only";

import { randomUUID } from "node:crypto";
import { one, query } from "@/lib/db";
import type { ExperienceLevel } from "@/lib/types";

export interface PracticeSession {
  id: string;
  skillId: string;
  skillName: string;
  skillType: "technical" | "soft";
  title: string;
  focus: string;
  drills: Array<{ title: string; instruction: string; timeboxMinutes: number }>;
  selfCheck: string;
  status: "not_started" | "in_progress" | "completed";
  createdAt: string;
}

function fallbackSession(skillName: string, skillType: "technical" | "soft", current: number, target: number) {
  const soft = skillType === "soft";
  return {
    title: `${skillName} — focused practice`,
    focus: soft
      ? `Practise ${skillName} in a real situation and reflect on what worked.`
      : `Move ${skillName} from level ${current} to ${target} through short, hands-on reps.`,
    drills: soft
      ? [
          { title: "Prepare", instruction: `Write down one upcoming situation where ${skillName} matters and your plan for it.`, timeboxMinutes: 15 },
          { title: "Do it", instruction: `Run the situation. Keep notes on decisions and reactions.`, timeboxMinutes: 45 },
          { title: "Get feedback", instruction: `Ask one person who saw it for one thing to keep and one to change.`, timeboxMinutes: 15 },
          { title: "Reflect", instruction: `Write a 6-line situation-action-result note you could retell in an interview.`, timeboxMinutes: 15 },
        ]
      : [
          { title: "Rebuild", instruction: `Implement a small feature that exercises ${skillName} from scratch, no tutorial.`, timeboxMinutes: 60 },
          { title: "Break & fix", instruction: `Introduce a realistic bug, then diagnose and fix it while narrating your reasoning.`, timeboxMinutes: 30 },
          { title: "Explain", instruction: `Write a short note explaining the trade-offs you made and why.`, timeboxMinutes: 20 },
        ],
    selfCheck: `You can explain your ${skillName} decisions out loud and point to something you built or did today.`,
  };
}

export async function createPracticeSession(userId: string, skillId: string, analysisId?: string | null) {
  const skill = await one<{ id: string; name: string; skillType: "technical" | "soft" } & Record<string, unknown>>(
    `SELECT id, name, skill_type AS "skillType" FROM skills WHERE id=$1`,
    [skillId],
  );
  if (!skill) throw new Error("SKILL_NOT_FOUND");

  const context = await one<{ roleTitle: string; experienceLevel: ExperienceLevel; currentLevel: number; targetLevel: number } & Record<string, unknown>>(
    `SELECT r.title AS "roleTitle", a.experience_level AS "experienceLevel",
       COALESCE(ar.current_level, 0) AS "currentLevel", COALESCE(ar.target_level, 3) AS "targetLevel"
     FROM analyses a JOIN roles r ON r.id=a.role_id
     LEFT JOIN analysis_skill_results ar ON ar.analysis_id=a.id AND ar.skill_id=$2
     WHERE a.user_id=$1 ${analysisId ? "AND a.id=$3" : ""}
     ORDER BY a.created_at DESC LIMIT 1`,
    analysisId ? [userId, skillId, analysisId] : [userId, skillId],
  );
  const roleTitle = context?.roleTitle ?? "your target role";
  const current = Number(context?.currentLevel ?? 0);
  const target = Number(context?.targetLevel ?? 3);

  let generator = "deterministic";
  let plan = fallbackSession(skill.name, skill.skillType, current, target);
  const gemini = await import("@/lib/gemini");
  if (gemini.isGeminiConfigured()) {
    try {
      plan = await gemini.generatePracticeSession({
        skillName: skill.name,
        skillType: skill.skillType,
        currentLevel: current,
        targetLevel: target,
        roleTitle,
      });
      generator = "gemini";
    } catch (error) {
      console.error("Gemini practice generation failed; using deterministic drills", error instanceof Error ? error.message : "unknown error");
    }
  }

  const id = randomUUID();
  await query(
    `INSERT INTO practice_sessions (id, user_id, skill_id, analysis_id, title, focus, drills, self_check, skill_type, generator)
     VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb,$8,$9,$10)`,
    [id, userId, skillId, analysisId ?? null, plan.title, plan.focus, JSON.stringify(plan.drills), plan.selfCheck, skill.skillType, generator],
  );
  return getPracticeSession(userId, id);
}

export async function getPracticeSession(userId: string, id: string) {
  return one<PracticeSession & Record<string, unknown>>(
    `SELECT p.id, p.skill_id AS "skillId", s.name AS "skillName", p.skill_type AS "skillType",
      p.title, p.focus, p.drills, p.self_check AS "selfCheck", p.status, p.created_at AS "createdAt"
     FROM practice_sessions p JOIN skills s ON s.id=p.skill_id
     WHERE p.id=$1 AND p.user_id=$2`,
    [id, userId],
  );
}

export async function listPracticeSessions(userId: string) {
  return query<PracticeSession & Record<string, unknown>>(
    `SELECT p.id, p.skill_id AS "skillId", s.name AS "skillName", p.skill_type AS "skillType",
      p.title, p.focus, p.drills, p.self_check AS "selfCheck", p.status, p.created_at AS "createdAt"
     FROM practice_sessions p JOIN skills s ON s.id=p.skill_id
     WHERE p.user_id=$1 ORDER BY (p.status='completed'), p.created_at DESC`,
    [userId],
  );
}

/** Skills the user lacks in this analysis that don't already have an open session. */
export async function suggestedPracticeSkills(userId: string, analysisId?: string | null) {
  return query<{ skillId: string; name: string; skillType: string; classification: string; currentLevel: number; targetLevel: number } & Record<string, unknown>>(
    `SELECT ar.skill_id AS "skillId", s.name, s.skill_type AS "skillType", ar.classification,
      ar.current_level AS "currentLevel", ar.target_level AS "targetLevel"
     FROM analysis_skill_results ar JOIN skills s ON s.id=ar.skill_id
     JOIN analyses a ON a.id=ar.analysis_id AND a.user_id=$1
     WHERE ar.classification <> 'strong'
       ${analysisId ? "AND a.id=$2" : "AND a.created_at=(SELECT max(created_at) FROM analyses WHERE user_id=$1)"}
       AND NOT EXISTS (
         SELECT 1 FROM practice_sessions p WHERE p.user_id=$1 AND p.skill_id=ar.skill_id AND p.status <> 'completed'
       )
     ORDER BY CASE ar.importance WHEN 'critical' THEN 0 WHEN 'high' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END, s.name
     LIMIT 12`,
    analysisId ? [userId, analysisId] : [userId],
  );
}

export async function setPracticeStatus(userId: string, id: string, status: PracticeSession["status"]) {
  const rows = await query<{ id: string; status: string }>(
    `UPDATE practice_sessions SET status=$1, updated_at=now() WHERE id=$2 AND user_id=$3 RETURNING id, status`,
    [status, id, userId],
  );
  return rows[0] ?? null;
}
