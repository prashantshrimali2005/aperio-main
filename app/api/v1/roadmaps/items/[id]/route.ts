import { requireUser } from "@/lib/auth";
import { fail, handleApiError, ok } from "@/lib/api";
import { query } from "@/lib/db";
import { idSchema, roadmapItemSchema } from "@/lib/validation";

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    const id = idSchema.parse((await context.params).id);
    const input = roadmapItemSchema.parse(await request.json());
    const rows = await query(
      `UPDATE roadmap_items ri SET status=$1,updated_at=now() FROM roadmaps rm
       WHERE ri.id=$2 AND rm.id=ri.roadmap_id AND rm.user_id=$3 RETURNING ri.id,ri.status`,
      [input.status, id, user.id],
    );
    return rows[0] ? ok(rows[0]) : fail("NOT_FOUND", "Roadmap item not found.", 404);
  } catch (error) { return handleApiError(error); }
}
