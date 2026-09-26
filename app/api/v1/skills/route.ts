import { handleApiError, ok } from "@/lib/api";
import { query } from "@/lib/db";

export async function GET() {
  try { return ok(await query("SELECT id,slug,name,category,description FROM skills ORDER BY category,name")); }
  catch (error) { return handleApiError(error); }
}
