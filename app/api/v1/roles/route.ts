import { getCurrentUser } from "@/lib/auth";
import { handleApiError, ok } from "@/lib/api";
import { getRoles } from "@/lib/reports";

export async function GET() {
  try { const user = await getCurrentUser(); return ok(await getRoles(user?.id)); }
  catch (error) { return handleApiError(error); }
}
