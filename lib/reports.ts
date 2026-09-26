import { one, query } from "@/lib/db";
import type { AnalysisReport, AnalysisSkill, RoleSummary } from "@/lib/types";

export async function getRoles(userId?: string) {
  const rows = await query<RoleSummary & { estimatedMatch: number | null; lastAnalyzedAt: string | null } & Record<string, unknown>>(
    userId
      ? `SELECT r.id,r.slug,r.title,r.description,r.category,
          latest.overall_score AS "estimatedMatch", latest.created_at AS "lastAnalyzedAt"
         FROM roles r
         LEFT JOIN LATERAL (
           SELECT overall_score,created_at FROM analyses a WHERE a.role_id=r.id AND a.user_id=$1 ORDER BY created_at DESC LIMIT 1
         ) latest ON true
         WHERE r.active=true ORDER BY r.title`
      : `SELECT id,slug,title,description,category,NULL::integer AS "estimatedMatch",NULL::timestamptz AS "lastAnalyzedAt" FROM roles WHERE active=true ORDER BY title`,
    userId ? [userId] : [],
  );
  return rows;
}

export async function getAnalysisReport(userId: string, analysisId: string): Promise<AnalysisReport | null> {
  const report = await one<Omit<AnalysisReport, "skills"> & Record<string, unknown>>(
    `SELECT a.id,a.role_id AS "roleId",r.title AS "roleTitle",a.experience_level AS "experienceLevel",
      a.overall_score AS "overallScore",a.technical_score AS "technicalScore",a.soft_score AS "softScore",
      a.summary,a.matched_count AS "matchedCount",
      a.developing_count AS "developingCount",a.missing_count AS "missingCount",
      rs.filename AS "resumeFilename",rs.validation_confidence AS "resumeValidationConfidence",a.created_at AS "createdAt"
     FROM analyses a JOIN roles r ON r.id=a.role_id LEFT JOIN resumes rs ON rs.id=a.resume_id
     WHERE a.id=$1 AND a.user_id=$2`,
    [analysisId, userId],
  );
  if (!report) return null;
  const skills = await query<AnalysisSkill & Record<string, unknown>>(
    `SELECT ar.id,ar.skill_id AS "skillId",s.name,s.category,s.description,s.skill_type AS "skillType",ar.classification,
      ar.current_level AS "currentLevel",ar.target_level AS "targetLevel",ar.confidence,ar.importance,
      ar.evidence,ar.evidence_basis AS "evidenceBasis",ar.recommendation,ar.why_it_matters AS "whyItMatters"
     FROM analysis_skill_results ar JOIN skills s ON s.id=ar.skill_id
     WHERE ar.analysis_id=$1
     ORDER BY CASE ar.classification WHEN 'missing' THEN 1 WHEN 'developing' THEN 2 ELSE 3 END,
       CASE ar.importance WHEN 'critical' THEN 1 WHEN 'high' THEN 2 WHEN 'medium' THEN 3 ELSE 4 END,s.name`,
    [analysisId],
  );
  return { ...report, skills } as AnalysisReport;
}

export async function getLatestReport(userId: string) {
  const latest = await one<{ id: string } & Record<string, unknown>>("SELECT id FROM analyses WHERE user_id=$1 ORDER BY created_at DESC LIMIT 1", [userId]);
  return latest ? getAnalysisReport(userId, latest.id) : null;
}

export async function getAnalysisHistory(userId: string, limit = 20, offset = 0) {
  return query<Record<string, unknown>>(
    `SELECT a.id,r.title AS "roleTitle",r.slug AS "roleSlug",a.experience_level AS "experienceLevel",
      a.overall_score AS "overallScore",a.technical_score AS "technicalScore",a.soft_score AS "softScore",
      a.matched_count AS "matchedCount",a.developing_count AS "developingCount",
      a.missing_count AS "missingCount",a.created_at AS "createdAt"
     FROM analyses a JOIN roles r ON r.id=a.role_id WHERE a.user_id=$1 ORDER BY a.created_at DESC LIMIT $2 OFFSET $3`,
    [userId, limit, offset],
  );
}

export async function getRoadmap(userId: string, analysisId?: string) {
  const roadmap = await one<Record<string, unknown>>(
    analysisId
      ? `SELECT rm.id,rm.title,rm.analysis_id AS "analysisId",r.title AS "roleTitle",a.overall_score AS "overallScore",rm.created_at AS "createdAt"
         FROM roadmaps rm JOIN analyses a ON a.id=rm.analysis_id JOIN roles r ON r.id=a.role_id
         WHERE rm.user_id=$1 AND rm.analysis_id=$2`
      : `SELECT rm.id,rm.title,rm.analysis_id AS "analysisId",r.title AS "roleTitle",a.overall_score AS "overallScore",rm.created_at AS "createdAt"
         FROM roadmaps rm JOIN analyses a ON a.id=rm.analysis_id JOIN roles r ON r.id=a.role_id
         WHERE rm.user_id=$1 ORDER BY rm.created_at DESC LIMIT 1`,
    analysisId ? [userId, analysisId] : [userId],
  );
  if (!roadmap) return null;
  const items = await query<Record<string, unknown>>(
    `SELECT ri.id,ri.phase,ri.priority,ri.effort,ri.status,ri.recommended_action AS "recommendedAction",
      ri.why_it_matters AS "whyItMatters",ri.position,s.id AS "skillId",s.name AS "skillName",s.category
     FROM roadmap_items ri JOIN skills s ON s.id=ri.skill_id WHERE ri.roadmap_id=$1 ORDER BY ri.position`,
    [roadmap.id],
  );
  return { ...roadmap, items };
}
