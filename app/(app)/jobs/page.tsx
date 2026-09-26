import { JobsBoard } from "@/components/jobs-board";
import { requirePageUser } from "@/lib/auth";
import { getJobsForUser } from "@/lib/jobs";

export const metadata = { title: "Jobs" };

export default async function JobsPage() {
  const user = await requirePageUser();
  const initial = await getJobsForUser(user.id, { scope: "all", limit: 24 });
  return (
    <div className="mx-auto max-w-[1000px] px-5 py-8 lg:px-10 lg:py-10">
      <JobsBoard initial={initial as never} />
    </div>
  );
}
