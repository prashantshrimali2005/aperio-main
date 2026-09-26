import { notFound } from "next/navigation";
import { AssessmentRunner } from "@/components/assessment-runner";
import { requirePageUser } from "@/lib/auth";
import { getAssessment } from "@/lib/assessment";

export const metadata = { title: "Skills check" };

export default async function AssessmentPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requirePageUser();
  const assessment = await getAssessment(user.id, (await params).id);
  if (!assessment) notFound();
  return (
    <div className="mx-auto max-w-[1000px] px-5 py-8 lg:px-10 lg:py-10">
      <AssessmentRunner assessment={assessment as never} />
    </div>
  );
}
