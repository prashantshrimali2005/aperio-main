import { requireUser } from "@/lib/auth";
import { fail, handleApiError, ok } from "@/lib/api";
import { runAnalysis } from "@/lib/analyzer";
import { one } from "@/lib/db";
import { notifyAnalysisReady } from "@/lib/notifications";
import { logActivity } from "@/lib/activity";
import { getAnalysisHistory } from "@/lib/reports";
import { analysisSchema, paginationSchema } from "@/lib/validation";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(request: Request) {
  try {
    const user = await requireUser();
    const url = new URL(request.url);
    const page = paginationSchema.parse(Object.fromEntries(url.searchParams));
    return ok(await getAnalysisHistory(user.id, page.limit, page.offset));
  } catch (error) { return handleApiError(error); }
}

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    const input = analysisSchema.parse(await request.json());
    const recent = await one<{ allowed: boolean } & Record<string, unknown>>(
      `SELECT NOT EXISTS(SELECT 1 FROM analyses WHERE user_id=$1 AND created_at > now() - interval '15 seconds') AS allowed`, [user.id],
    );
    if (recent && !recent.allowed) return fail("RATE_LIMITED", "Please wait a moment before running another analysis.", 429);
    const result = await runAnalysis(user.id, input.roleId, input.experienceLevel, input.resumeId);
    await logActivity({
      action: "analysis.run", userId: user.id, entityType: "analysis", entityId: result.id,
      metadata: { roleId: input.roleId, level: input.experienceLevel, overall: result.overallScore, technical: result.technicalScore, soft: result.softScore },
      request,
    });
    await notifyAnalysisReady(user.id, result.id).catch((error) => {
      console.error("Analysis notification failed", error instanceof Error ? error.message : "unknown error");
    });
    return ok(result, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message === "PROFILE_EMPTY") return fail("PROFILE_EMPTY", "Add a resume or profile details before analyzing a role.", 422);
    if (error instanceof Error && error.message === "ROLE_NOT_FOUND") return fail("ROLE_NOT_FOUND", "The selected role is unavailable.", 404);
    if (error instanceof Error && error.message === "RESUME_NOT_FOUND") return fail("RESUME_NOT_FOUND", "The selected resume is unavailable.", 404);
    return handleApiError(error);
  }
}
