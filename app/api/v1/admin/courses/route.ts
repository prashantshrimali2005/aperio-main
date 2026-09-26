import { requireAdmin } from "@/lib/admin";
import { handleApiError, ok } from "@/lib/api";
import { listCourses, saveCourse } from "@/lib/lms";
import { logActivity } from "@/lib/activity";
import { courseSaveSchema } from "@/lib/validation";

export const runtime = "nodejs";

export async function GET() {
  try {
    await requireAdmin();
    return ok(await listCourses());
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: Request) {
  try {
    const admin = await requireAdmin();
    const input = courseSaveSchema.parse(await request.json());
    const course = await saveCourse(
      {
        id: input.id,
        title: input.title,
        summary: input.summary,
        level: input.level,
        track: input.track,
        skillIds: input.skillIds,
        published: input.published,
        priceInr: input.priceInr,
        lessons: input.lessons?.map((l) => ({
          id: l.id,
          title: l.title,
          kind: l.kind,
          content: l.content ?? "",
          resourceUrl: l.resourceUrl ?? null,
          durationMin: l.durationMin ?? null,
          position: l.position ?? 0,
        })),
      },
      admin.email,
    );
    await logActivity({ action: "admin.integration.save", userId: admin.id, actorEmail: admin.email, entityType: "course", entityId: course?.id, metadata: { published: course?.published }, request });
    return ok(course, { status: input.id ? 200 : 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
