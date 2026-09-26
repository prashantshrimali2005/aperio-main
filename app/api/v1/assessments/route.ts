import { requireUser } from "@/lib/auth";
import { fail, handleApiError, ok } from "@/lib/api";
import { one } from "@/lib/db";
import { createAssessment, getAssessment } from "@/lib/assessment";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET() {
  try {
    const user = await requireUser();
    const latest = await one<{ id: string }>(
      "SELECT id FROM skill_assessments WHERE user_id=$1 ORDER BY created_at DESC LIMIT 1",
      [user.id],
    );
    return ok(latest ? await getAssessment(user.id, latest.id) : null);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    const body = (await request.json().catch(() => ({}))) as { analysisId?: string };
    const assessment = await createAssessment(user.id, body.analysisId ?? null);
    return ok(assessment, { status: 201 });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "ANALYSIS_NOT_FOUND") return fail("ANALYSIS_NOT_FOUND", "Run an analysis first.", 422);
      if (error.message === "AI_NOT_CONFIGURED") return fail("AI_NOT_CONFIGURED", "Skill tests need Gemini configured.", 503);
      if (["NO_SKILLS", "NO_QUESTIONS", "GEMINI_EMPTY_ASSESSMENT"].includes(error.message)) {
        return fail("ASSESSMENT_UNAVAILABLE", "Could not build a test for this analysis right now.", 502);
      }
    }
    return handleApiError(error);
  }
}
