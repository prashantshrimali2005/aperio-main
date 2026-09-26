export const experienceLevels = ["junior", "mid", "senior"] as const;
export type ExperienceLevel = (typeof experienceLevels)[number];

export const skillLevels = ["aware", "beginner", "working", "proficient", "advanced"] as const;
export type SkillLevel = (typeof skillLevels)[number];

export const skillLevelValue: Record<SkillLevel, number> = {
  aware: 0,
  beginner: 1,
  working: 2,
  proficient: 3,
  advanced: 4,
};

export const skillLevelLabel: Record<number, string> = {
  0: "Aware",
  1: "Beginner",
  2: "Working",
  3: "Proficient",
  4: "Advanced",
};

export type Classification = "strong" | "developing" | "missing";
export type Importance = "critical" | "high" | "medium" | "optional";
export type SkillType = "technical" | "soft";
export type RoadmapStatus = "not_started" | "in_progress" | "completed";

export interface SessionUser {
  id: string;
  email: string;
  fullName: string;
  onboardingCompleted: boolean;
  role: "user" | "admin";
}

export interface RoleSummary {
  id: string;
  slug: string;
  title: string;
  description: string;
  category: string;
}

export interface AnalysisSkill {
  id: string;
  skillId: string;
  name: string;
  category: string;
  description: string;
  classification: Classification;
  skillType: SkillType;
  currentLevel: number;
  targetLevel: number;
  confidence: number;
  importance: Importance;
  evidence: Array<{ quote: string; source: string }>;
  evidenceBasis?: string;
  recommendation: string;
  whyItMatters: string;
}

export interface AnalysisReport {
  id: string;
  roleId: string;
  roleTitle: string;
  experienceLevel: ExperienceLevel;
  overallScore: number;
  technicalScore: number | null;
  softScore: number | null;
  summary: string;
  matchedCount: number;
  developingCount: number;
  missingCount: number;
  resumeFilename?: string | null;
  resumeValidationConfidence?: number | null;
  createdAt: string;
  skills: AnalysisSkill[];
}
