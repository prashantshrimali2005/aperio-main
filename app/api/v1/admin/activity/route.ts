import { requireAdmin } from "@/lib/admin";
import { handleApiError, ok } from "@/lib/api";
import { getActivityFeed } from "@/lib/admin-data";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    await requireAdmin();
    const params = new URL(request.url).searchParams;
    return ok(
      await getActivityFeed({
        action: params.get("action")?.trim() || undefined,
        userId: params.get("userId")?.trim() || undefined,
        limit: params.get("limit") ? Number(params.get("limit")) : undefined,
        offset: params.get("offset") ? Number(params.get("offset")) : undefined,
      }),
    );
  } catch (error) {
    return handleApiError(error);
  }
}
