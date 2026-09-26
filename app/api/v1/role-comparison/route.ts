import { requireUser } from "@/lib/auth";
import { fail, handleApiError, ok } from "@/lib/api";
import { getAnalysisReport } from "@/lib/reports";
import { idSchema } from "@/lib/validation";

export async function GET(request: Request) {
  try {
    const user = await requireUser();
    const params = new URL(request.url).searchParams;
    const leftId = idSchema.parse(params.get("left"));
    const rightId = idSchema.parse(params.get("right"));
    if (leftId === rightId) return fail("VALIDATION_ERROR", "Choose two different analyses.", 422);
    const [left, right] = await Promise.all([getAnalysisReport(user.id, leftId), getAnalysisReport(user.id, rightId)]);
    if (!left || !right) return fail("NOT_FOUND", "One or both analyses could not be found.", 404);
    const leftNames = new Set(left.skills.filter((item) => item.classification === "strong").map((item) => item.name));
    const rightNames = new Set(right.skills.filter((item) => item.classification === "strong").map((item) => item.name));
    const sharedSkills = [...leftNames].filter((name) => rightNames.has(name));
    const leftGaps = left.skills.filter((item) => item.classification !== "strong").slice(0, 5).map((item) => item.name);
    const rightGaps = right.skills.filter((item) => item.classification !== "strong").slice(0, 5).map((item) => item.name);
    return ok({ left, right, sharedSkills, leftGaps, rightGaps });
  } catch (error) { return handleApiError(error); }
}
