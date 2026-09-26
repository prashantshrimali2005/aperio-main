import { LmsWorkspace } from "@/components/admin/lms-workspace";
import { requireAdminPage } from "@/lib/admin";
import { query } from "@/lib/db";
import { listCourses } from "@/lib/lms";
import { listQuestionSets } from "@/lib/quiz-bank";

export const metadata = { title: "Admin · LMS" };

export default async function AdminLmsPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  await requireAdminPage();
  const { tab } = await searchParams;
  const [courses, skills, questionSets] = await Promise.all([
    listCourses(),
    query<Record<string, unknown>>(`SELECT id, name, skill_type AS "skillType" FROM skills ORDER BY skill_type, name`),
    listQuestionSets(),
  ]);
  return (
    <LmsWorkspace
      courses={courses as never}
      skills={skills as never}
      questionSets={questionSets as never}
      initialTab={tab}
    />
  );
}
