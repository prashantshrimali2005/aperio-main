import { z } from "zod";
import { experienceLevels, skillLevels } from "@/lib/types";

export const idSchema = z.string().min(2).max(100).regex(/^[a-zA-Z0-9_-]+$/);
export const experienceLevelSchema = z.enum(experienceLevels);

export const registerSchema = z.object({
  fullName: z.string().trim().min(2).max(80),
  email: z.email().transform((value) => value.toLowerCase()),
  password: z.string().min(10, "Use at least 10 characters").max(128),
});

export const loginSchema = z.object({
  email: z.email().transform((value) => value.toLowerCase()),
  password: z.string().min(1).max(128),
});

export const forgotPasswordSchema = z.object({
  email: z.email().transform((value) => value.toLowerCase()),
});

export const resetPasswordSchema = z.object({
  token: z.string().trim().min(16).max(200),
  password: z.string().min(10, "Use at least 10 characters").max(128),
});

export const profileSchema = z.object({
  fullName: z.string().trim().min(2).max(80).optional(),
  headline: z.string().trim().max(140).optional().nullable(),
  currentStatus: z.enum(["student", "fresher", "professional", "career_switcher"]).optional().nullable(),
  bio: z.string().trim().max(1000).optional().nullable(),
  location: z.string().trim().max(100).optional().nullable(),
  yearsExperience: z.number().min(0).max(60).optional().nullable(),
  targetRoleId: idSchema.optional().nullable(),
  targetLevel: experienceLevelSchema.optional().nullable(),
  onboardingCompleted: z.boolean().optional(),
});

export const analysisSchema = z.object({
  roleId: idSchema,
  experienceLevel: experienceLevelSchema,
  resumeId: idSchema.optional().nullable(),
});

export const userSkillSchema = z.object({
  level: z.enum(skillLevels),
  userVerified: z.boolean().default(true),
});

export const roadmapItemSchema = z.object({
  status: z.enum(["not_started", "in_progress", "completed"]),
});

export const notificationPreferencesSchema = z.object({
  notifyRoadmap: z.boolean().optional(),
  notifyWeeklyDigest: z.boolean().optional(),
  notifyAnalysis: z.boolean().optional(),
  notifyInactivity: z.boolean().optional(),
  notifyEmail: z.boolean().optional(),
});

export const learningPathSchema = z.object({
  analysisId: idSchema.optional().nullable(),
  weeklyHours: z.coerce.number().int().min(2).max(40).default(6),
});

export const learningModuleSchema = z.object({
  status: z.enum(["not_started", "in_progress", "completed"]),
});

export const progressStatusSchema = z.object({
  status: z.enum(["not_started", "in_progress", "completed"]),
});

export const assessmentSubmitSchema = z.object({
  answers: z.array(z.object({ questionId: idSchema, answerIndex: z.number().int().min(0).max(3) })).min(1).max(80),
});

export const practiceCreateSchema = z.object({
  skillId: idSchema,
  analysisId: idSchema.optional().nullable(),
});

export const courseSaveSchema = z.object({
  id: idSchema.optional(),
  title: z.string().trim().min(3).max(160),
  summary: z.string().trim().max(2000).optional(),
  level: z.enum(["junior", "mid", "senior", "all"]).optional(),
  track: z.enum(["technical", "soft", "mixed"]).optional(),
  skillIds: z.array(idSchema).max(40).optional(),
  published: z.boolean().optional(),
  priceInr: z.coerce.number().int().min(0).max(100000).optional(),
  lessons: z
    .array(
      z.object({
        id: z.string().optional(),
        title: z.string().trim().min(1).max(160),
        kind: z.enum(["reading", "exercise", "video", "quiz", "project"]),
        content: z.string().max(20000).optional().default(""),
        resourceUrl: z.string().url().max(500).optional().nullable(),
        durationMin: z.number().int().min(1).max(600).optional().nullable(),
        position: z.number().int().min(0).max(500).optional().default(0),
      }),
    )
    .max(60)
    .optional(),
});

export const courseGenerateSchema = z.object({
  topic: z.string().trim().min(4).max(200),
  level: z.enum(["junior", "mid", "senior", "all"]).optional(),
  track: z.enum(["technical", "soft", "mixed"]).optional(),
  lessonCount: z.coerce.number().int().min(4).max(12).optional(),
  audience: z.string().trim().max(200).optional(),
});

export const courseTopicSuggestSchema = z.object({
  focus: z.string().trim().max(200).optional(),
});

export const questionSetGenerateSchema = z.object({
  topic: z.string().trim().min(3).max(200),
  niche: z.string().trim().max(60).optional(),
  level: z.enum(["junior", "mid", "senior", "all"]).optional(),
  count: z.coerce.number().int().min(5).max(25).optional(),
  priceInr: z.coerce.number().int().min(0).max(100000).optional(),
});

export const questionSetAttemptSchema = z.object({
  answers: z.array(z.object({ questionId: idSchema, answerIndex: z.number().int().min(0).max(3) })).min(1).max(30),
});

export const marketSourceSchema = z.object({
  id: idSchema.optional(),
  name: z.string().trim().min(2).max(120),
  kind: z.enum(["api", "agency", "manual"]).optional(),
  weight: z.coerce.number().min(0).max(10).optional(),
  integrationKey: z.string().max(60).optional().nullable(),
  region: z.string().trim().max(40).optional(),
  enabled: z.boolean().optional(),
  config: z.record(z.string(), z.unknown()).optional(),
});

export const paginationSchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
});
