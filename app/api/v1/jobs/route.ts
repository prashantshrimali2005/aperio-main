import { requireUser } from "@/lib/auth";
import { handleApiError, ok } from "@/lib/api";
import { getJobsForUser } from "@/lib/jobs";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const user = await requireUser();
    const p = new URL(request.url).searchParams;
    const scopeParam = p.get("scope");
    return ok(
      await getJobsForUser(user.id, {
        scope: scopeParam === "have" || scopeParam === "target" ? scopeParam : "all",
        remote: p.get("remote") === "1" ? true : undefined,
        q: p.get("q")?.trim() || undefined,
        limit: p.get("limit") ? Number(p.get("limit")) : undefined,
        offset: p.get("offset") ? Number(p.get("offset")) : undefined,
      }),
    );
  } catch (error) {
    return handleApiError(error);
  }
}
