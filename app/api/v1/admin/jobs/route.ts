import { requireAdmin } from "@/lib/admin";
import { handleApiError, ok } from "@/lib/api";
import { logActivity } from "@/lib/activity";
import { getJobStats, runJobIngestion } from "@/lib/jobs";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function GET() {
  try {
    await requireAdmin();
    return ok(await getJobStats());
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: Request) {
  try {
    const admin = await requireAdmin();
    const result = await runJobIngestion();
    await logActivity({ action: "admin.integration.save", userId: admin.id, actorEmail: admin.email, entityType: "jobs", metadata: result as Record<string, unknown>, request });
    return ok({ result, stats: await getJobStats() });
  } catch (error) {
    return handleApiError(error);
  }
}
