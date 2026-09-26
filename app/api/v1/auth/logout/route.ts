import { destroySession } from "@/lib/auth";
import { handleApiError, ok } from "@/lib/api";

export async function POST() {
  try { await destroySession(); return ok({ signedOut: true }); }
  catch (error) { return handleApiError(error); }
}
