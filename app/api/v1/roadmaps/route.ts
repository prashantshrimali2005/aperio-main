import { requireUser } from "@/lib/auth";
import { handleApiError, ok } from "@/lib/api";
import { getRoadmap } from "@/lib/reports";

export async function GET(request: Request) {
  try {
    const user = await requireUser();
    const analysisId = new URL(request.url).searchParams.get("analysisId") ?? undefined;
    return ok(await getRoadmap(user.id, analysisId));
  } catch (error) { return handleApiError(error); }
}
