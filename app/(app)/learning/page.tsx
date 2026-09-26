import { LearningPathView } from "@/components/learning-path-view";
import { requirePageUser } from "@/lib/auth";
import { getLearningPath } from "@/lib/learning";

export const metadata = { title: "Course Plan" };

export default async function LearningPage() {
  const user = await requirePageUser();
  const path = await getLearningPath(user.id);
  return (
    <div className="mx-auto max-w-[1000px] px-5 py-8 lg:px-10 lg:py-10">
      <div className="max-w-2xl">
        <p className="text-sm font-semibold text-[var(--primary)]">Tailored for you</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-[-.04em]">Your course plan</h1>
        <p className="mt-3 text-sm leading-6 text-[var(--muted)]">
          A personalised, week-by-week study plan built from the specific gaps in your latest analysis — objectives, projects, and checkpoints, paced to your weekly hours.
        </p>
      </div>
      <div className="mt-8">
        <LearningPathView initialPath={path as never} />
      </div>
    </div>
  );
}
