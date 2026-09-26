import { requireUser } from "@/lib/auth";
import { handleApiError, ok } from "@/lib/api";
import { getEnrolledCourses, getRecommendedCourses } from "@/lib/lms";

export const runtime = "nodejs";

export async function GET() {
  try {
    const user = await requireUser();
    const [recommended, enrolled] = await Promise.all([
      getRecommendedCourses(user.id),
      getEnrolledCourses(user.id),
    ]);
    return ok({ recommended, enrolled });
  } catch (error) {
    return handleApiError(error);
  }
}
