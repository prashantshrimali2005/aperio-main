import { randomUUID } from "node:crypto";
import { db, one, query } from "@/lib/db";

export interface CourseLesson {
  id?: string;
  title: string;
  kind: "reading" | "exercise" | "video" | "quiz" | "project";
  content: string;
  resourceUrl: string | null;
  durationMin: number | null;
  position: number;
}

export interface Course {
  id: string;
  slug: string;
  title: string;
  summary: string;
  level: "junior" | "mid" | "senior" | "all";
  track: "technical" | "soft" | "mixed";
  skillIds: string[];
  published: boolean;
  priceInr: number;
  createdBy: string | null;
  updatedAt: string;
  lessons: CourseLesson[];
}

function slugify(title: string) {
  return title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "").slice(0, 60) || `course-${Date.now()}`;
}

export async function listCourses(opts: { publishedOnly?: boolean } = {}) {
  return query<Record<string, unknown>>(
    `SELECT c.id, c.slug, c.title, c.summary, c.level, c.track, c.skill_ids AS "skillIds", c.published,
      c.price_inr AS "priceInr", c.updated_at AS "updatedAt",
      (SELECT count(*) FROM course_lessons l WHERE l.course_id=c.id) AS lessons,
      (SELECT count(*) FROM course_enrollments e WHERE e.course_id=c.id) AS enrollments
     FROM courses c
     ${opts.publishedOnly ? "WHERE c.published=true" : ""}
     ORDER BY c.updated_at DESC`,
  );
}

export async function getCourse(id: string): Promise<Course | null> {
  const course = await one<Record<string, unknown>>(
    `SELECT id, slug, title, summary, level, track, skill_ids AS "skillIds", published,
       price_inr AS "priceInr", created_by AS "createdBy", updated_at AS "updatedAt"
     FROM courses WHERE id=$1`,
    [id],
  );
  if (!course) return null;
  const lessons = await query<Record<string, unknown>>(
    `SELECT id, title, kind, content, resource_url AS "resourceUrl", duration_min AS "durationMin", position
     FROM course_lessons WHERE course_id=$1 ORDER BY position`,
    [id],
  );
  return { ...(course as unknown as Course), lessons: lessons as unknown as CourseLesson[] };
}

export async function saveCourse(
  input: {
    id?: string;
    title: string;
    summary?: string;
    level?: Course["level"];
    track?: Course["track"];
    skillIds?: string[];
    published?: boolean;
    priceInr?: number;
    lessons?: CourseLesson[];
  },
  editor: string,
) {
  const id = input.id ?? randomUUID();
  const slug = slugify(input.title);
  const skillIds = (input.skillIds ?? []).filter(Boolean).slice(0, 40);
  const priceInr = Math.max(0, Math.min(100000, Math.round(Number(input.priceInr ?? 0) || 0)));
  const lessons = (input.lessons ?? []).map((l, index) => ({
    id: l.id && /^[a-f0-9-]{36}$/.test(l.id) ? l.id : randomUUID(),
    title: String(l.title || "Untitled lesson").slice(0, 160),
    kind: (["reading", "exercise", "video", "quiz", "project"] as const).includes(l.kind) ? l.kind : "reading",
    content: String(l.content ?? "").slice(0, 20000),
    resourceUrl: l.resourceUrl ? String(l.resourceUrl).slice(0, 500) : null,
    durationMin: l.durationMin ? Math.max(1, Math.min(600, Number(l.durationMin))) : null,
    position: index,
  }));

  const sql = db();
  await sql.transaction((tx) => [
    tx`INSERT INTO courses (id, slug, title, summary, level, track, skill_ids, published, price_inr, created_by, updated_at)
       VALUES (${id}, ${slug}, ${input.title.slice(0, 160)}, ${(input.summary ?? "").slice(0, 2000)},
         ${input.level ?? "mid"}, ${input.track ?? "technical"}, ${skillIds}, ${input.published ?? false}, ${priceInr}, ${editor}, now())
       ON CONFLICT (id) DO UPDATE SET title=EXCLUDED.title, summary=EXCLUDED.summary, level=EXCLUDED.level,
         track=EXCLUDED.track, skill_ids=EXCLUDED.skill_ids, published=EXCLUDED.published, price_inr=EXCLUDED.price_inr, updated_at=now()`,
    tx`DELETE FROM course_lessons WHERE course_id=${id}`,
    ...lessons.map(
      (l) => tx`INSERT INTO course_lessons (id, course_id, title, kind, content, resource_url, duration_min, position)
        VALUES (${l.id}, ${id}, ${l.title}, ${l.kind}, ${l.content}, ${l.resourceUrl}, ${l.durationMin}, ${l.position})`,
    ),
  ]);
  return getCourse(id);
}

export async function deleteCourse(id: string) {
  await query("DELETE FROM courses WHERE id=$1", [id]);
}

// --- AI authoring ------------------------------------------------------------

/** Map free-text skill names from Gemini onto real skills.id values by name/alias. */
async function resolveSkillIds(names: string[]): Promise<string[]> {
  const clean = [...new Set(names.map((n) => n.trim()).filter(Boolean))].slice(0, 20);
  if (!clean.length) return [];
  const rows = await query<{ id: string }>(
    `SELECT DISTINCT s.id
       FROM skills s, unnest($1::text[]) AS want(name)
      WHERE lower(s.name) = lower(want.name)
         OR lower(want.name) = ANY (SELECT lower(a) FROM unnest(s.aliases) AS a)`,
    [clean],
  );
  return rows.map((r) => r.id);
}

/**
 * Suggest topics for the admin. Returns the raw Gemini list plus, for each,
 * the subset of skill names that already exist in the catalog.
 */
export async function suggestCourseTopics(focus?: string) {
  const gemini = await import("@/lib/gemini");
  if (!gemini.isGeminiConfigured()) throw new Error("GEMINI_NOT_CONFIGURED");
  const [existing, roles] = await Promise.all([
    query<{ title: string }>(`SELECT title FROM courses ORDER BY updated_at DESC LIMIT 40`),
    query<{ title: string }>(`SELECT DISTINCT r.title FROM roles r JOIN profiles p ON p.target_role_id = r.id LIMIT 20`),
  ]);
  const out = await gemini.suggestCourseTopics({
    focus,
    existingTitles: existing.map((r) => r.title),
    roleTitles: roles.map((r) => r.title),
  });
  return out.topics;
}

/**
 * Generate a full course with Gemini and save it as an unpublished draft the
 * admin can review, tweak and publish.
 */
export async function generateCourseDraft(
  input: {
    topic: string;
    level?: Course["level"];
    track?: Course["track"];
    lessonCount?: number;
    audience?: string;
  },
  editor: string,
) {
  const gemini = await import("@/lib/gemini");
  if (!gemini.isGeminiConfigured()) throw new Error("GEMINI_NOT_CONFIGURED");

  const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, " ").replace(/\s+/g, " ").trim();

  const [catalog, existing] = await Promise.all([
    query<{ name: string }>(`SELECT name FROM skills ORDER BY name`),
    query<{ title: string }>(`SELECT title FROM courses`),
  ]);
  const existingNorm = new Set(existing.map((r) => norm(r.title)));
  if (existingNorm.has(norm(input.topic))) throw new Error("DUPLICATE_COURSE");

  const generated = await gemini.generateCourse({
    topic: input.topic,
    level: input.level,
    track: input.track,
    lessonCount: input.lessonCount,
    audience: input.audience,
    knownSkills: catalog.map((r) => r.name),
    avoidTitles: existing.map((r) => r.title),
  });

  if (existingNorm.has(norm(generated.title))) throw new Error("DUPLICATE_COURSE");

  // Drop duplicate lessons (same normalised title) before saving.
  const seenLesson = new Set<string>();
  const lessons = generated.lessons.filter((l) => {
    const k = norm(l.title);
    if (!k || seenLesson.has(k)) return false;
    seenLesson.add(k);
    return true;
  });
  if (lessons.length < 3) throw new Error("GEMINI_EMPTY_COURSE");

  const skillIds = await resolveSkillIds(generated.skills);

  const course = await saveCourse(
    {
      title: generated.title,
      summary: generated.summary,
      level: generated.level,
      track: generated.track,
      skillIds,
      published: false,
      lessons: lessons.map((l, position) => ({
        title: l.title,
        kind: l.kind === "quiz" ? "quiz" : l.kind === "project" ? "project" : l.kind === "exercise" ? "exercise" : "reading",
        content: l.content,
        resourceUrl: null,
        durationMin: l.durationMin,
        position,
      })),
    },
    editor,
  );
  return { course, skillNames: generated.skills, matchedSkillCount: skillIds.length };
}

// --- user side -----------------------------------------------------------

export async function getRecommendedCourses(userId: string) {
  return query<Record<string, unknown>>(
    `WITH gaps AS (
       SELECT DISTINCT ar.skill_id
       FROM analysis_skill_results ar
       JOIN analyses a ON a.id=ar.analysis_id AND a.user_id=$1
       WHERE ar.classification <> 'strong'
         AND a.created_at = (SELECT max(created_at) FROM analyses WHERE user_id=$1)
     )
     SELECT c.id, c.slug, c.title, c.summary, c.level, c.track, c.price_inr AS "priceInr",
       (SELECT count(*) FROM course_lessons l WHERE l.course_id=c.id) AS lessons,
       cardinality(ARRAY(SELECT unnest(c.skill_ids) INTERSECT SELECT skill_id FROM gaps)) AS "matchCount",
       EXISTS (SELECT 1 FROM course_enrollments e WHERE e.course_id=c.id AND e.user_id=$1) AS "enrolled",
       (c.price_inr <= 0 OR EXISTS (SELECT 1 FROM payments p WHERE p.user_id=$1 AND p.item_type='course' AND p.item_id=c.id AND p.status='paid')) AS "owned"
     FROM courses c
     WHERE c.published = true
       AND cardinality(ARRAY(SELECT unnest(c.skill_ids) INTERSECT SELECT skill_id FROM gaps)) > 0
     ORDER BY "matchCount" DESC, c.updated_at DESC
     LIMIT 12`,
    [userId],
  );
}

export async function getEnrolledCourses(userId: string) {
  return query<Record<string, unknown>>(
    `SELECT c.id, c.slug, c.title, c.summary, c.track, e.status, e.source, e.enrolled_at AS "enrolledAt",
      (SELECT count(*) FROM course_lessons l WHERE l.course_id=c.id) AS lessons,
      (SELECT count(*) FROM lesson_progress lp WHERE lp.enrollment_id=e.id AND lp.status='completed') AS completed
     FROM course_enrollments e JOIN courses c ON c.id=e.course_id
     WHERE e.user_id=$1 ORDER BY e.enrolled_at DESC`,
    [userId],
  );
}

export async function enrollInCourse(userId: string, courseId: string, source: "self" | "recommended" = "self") {
  const course = await one<{ id: string; priceInr: number }>(
    `SELECT id, price_inr AS "priceInr" FROM courses WHERE id=$1 AND published=true`,
    [courseId],
  );
  if (!course) throw new Error("COURSE_NOT_FOUND");
  if (course.priceInr > 0) {
    const { hasEntitlement } = await import("@/lib/payments");
    if (!(await hasEntitlement(userId, "course", courseId))) throw new Error("PAYMENT_REQUIRED");
  }
  await query(
    `INSERT INTO course_enrollments (id, user_id, course_id, source)
     VALUES ($1,$2,$3,$4) ON CONFLICT (user_id, course_id) DO NOTHING`,
    [randomUUID(), userId, courseId, source],
  );
  return getCourseForLearner(userId, courseId);
}

export async function getCourseForLearner(userId: string, courseId: string) {
  const course = await one<Record<string, unknown>>(
    `SELECT c.id, c.slug, c.title, c.summary, c.level, c.track, c.price_inr AS "priceInr",
       e.id AS "enrollmentId", e.status AS "enrollmentStatus"
     FROM courses c
     LEFT JOIN course_enrollments e ON e.course_id=c.id AND e.user_id=$1
     WHERE c.id=$2 AND c.published=true`,
    [userId, courseId],
  );
  if (!course) return null;
  if (Number(course.priceInr) > 0) {
    const { hasEntitlement } = await import("@/lib/payments");
    if (!(await hasEntitlement(userId, "course", courseId))) {
      return { ...course, locked: true, lessons: [] };
    }
  }
  const lessons = await query<Record<string, unknown>>(
    `SELECT l.id, l.title, l.kind, l.content, l.resource_url AS "resourceUrl", l.duration_min AS "durationMin", l.position,
       COALESCE(lp.status, 'not_started') AS status
     FROM course_lessons l
     LEFT JOIN lesson_progress lp ON lp.lesson_id=l.id AND lp.enrollment_id=$2
     WHERE l.course_id=$1 ORDER BY l.position`,
    [courseId, course.enrollmentId ?? null],
  );
  return { ...course, lessons };
}

export async function setLessonProgress(userId: string, lessonId: string, status: "not_started" | "in_progress" | "completed") {
  const enrollment = await one<{ id: string }>(
    `SELECT e.id FROM course_enrollments e
     JOIN course_lessons l ON l.course_id=e.course_id
     WHERE l.id=$1 AND e.user_id=$2`,
    [lessonId, userId],
  );
  if (!enrollment) throw new Error("NOT_ENROLLED");
  await query(
    `INSERT INTO lesson_progress (id, enrollment_id, lesson_id, status, updated_at)
     VALUES ($1,$2,$3,$4, now())
     ON CONFLICT (enrollment_id, lesson_id) DO UPDATE SET status=EXCLUDED.status, updated_at=now()`,
    [randomUUID(), enrollment.id, lessonId, status],
  );
  // roll enrollment to completed when all lessons are done
  await query(
    `UPDATE course_enrollments e SET status='completed'
     WHERE e.id=$1
       AND NOT EXISTS (
         SELECT 1 FROM course_lessons l
         LEFT JOIN lesson_progress lp ON lp.lesson_id=l.id AND lp.enrollment_id=e.id
         WHERE l.course_id=e.course_id AND COALESCE(lp.status,'not_started') <> 'completed'
       )`,
    [enrollment.id],
  );
  return { lessonId, status };
}
