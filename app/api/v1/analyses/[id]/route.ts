import { requireUser } from "@/lib/auth";
import { fail, handleApiError, ok } from "@/lib/api";
import { getAnalysisReport } from "@/lib/reports";
import { idSchema } from "@/lib/validation";

export async function GET(_: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    const id = idSchema.parse((await context.params).id);
    const report = await getAnalysisReport(user.id, id);
    return report ? ok(report) : fail("NOT_FOUND", "Analysis not found.", 404);
  } catch (error) { return handleApiError(error); }
}
