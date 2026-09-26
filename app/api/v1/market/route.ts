import { getCurrentUser } from "@/lib/auth";
import { fail, handleApiError, ok } from "@/lib/api";
import { one } from "@/lib/db";
import { getMarketOutlook, getRoleLeverage } from "@/lib/market";
import { experienceLevelSchema, idSchema } from "@/lib/validation";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    await getCurrentUser();
    const params = new URL(request.url).searchParams;
    const roleId = idSchema.parse(params.get("roleId"));
    const experienceLevel = experienceLevelSchema.parse(params.get("level") ?? "mid");
    const region = (params.get("region") ?? "global").slice(0, 40);

    const role = await one("SELECT id FROM roles WHERE id=$1 AND active=true", [roleId]);
    if (!role) return fail("NOT_FOUND", "Role not found.", 404);

    const leverage = await getRoleLeverage(roleId, experienceLevel);
    const outlook = await getMarketOutlook(leverage.map((item) => item.skillId), region);
    return ok({ roleId, experienceLevel, region, leverage, outlook });
  } catch (error) {
    return handleApiError(error);
  }
}
