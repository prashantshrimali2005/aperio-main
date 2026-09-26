import { requireAdmin } from "@/lib/admin";
import { handleApiError, ok } from "@/lib/api";
import { getUserList } from "@/lib/admin-data";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    await requireAdmin();
    const params = new URL(request.url).searchParams;
    return ok(
      await getUserList({
        q: params.get("q")?.trim() || undefined,
        limit: params.get("limit") ? Number(params.get("limit")) : undefined,
        offset: params.get("offset") ? Number(params.get("offset")) : undefined,
      }),
    );
  } catch (error) {
    return handleApiError(error);
  }
}
