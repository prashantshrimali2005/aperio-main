import { LearnHub } from "@/components/learn-hub";
import { requirePageUser } from "@/lib/auth";
import { getEnrolledCourses, getRecommendedCourses } from "@/lib/lms";
import { listPracticeSessions, suggestedPracticeSkills } from "@/lib/practice";
import { listQuestionSetsForUser } from "@/lib/quiz-bank";

export const metadata = { title: "Learn" };

export default async function CoursesPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const user = await requirePageUser();
  const { tab } = await searchParams;
  const [recommended, enrolled, sessions, suggestions, quizSets] = await Promise.all([
    getRecommendedCourses(user.id),
    getEnrolledCourses(user.id),
    listPracticeSessions(user.id),
    suggestedPracticeSkills(user.id),
    listQuestionSetsForUser(user.id),
  ]);
  return (
    <LearnHub
      courses={{ recommended: recommended as never[], enrolled: enrolled as never[] }}
      practice={{ sessions: sessions as never[], suggestions: suggestions as never[] }}
      quizSets={quizSets as never[]}
      initialTab={tab}
    />
  );
}
