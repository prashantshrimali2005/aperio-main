import { requireAdmin } from "@/lib/admin";
import { handleApiError, ok } from "@/lib/api";
import { listMarketSources, saveMarketSource } from "@/lib/market";
import { INTEGRATION_SCHEMAS } from "@/lib/settings";
import { marketSourceSchema } from "@/lib/validation";

export const runtime = "nodejs";

export async function GET() {
  try {
    await requireAdmin();
    return ok({
      sources: await listMarketSources(),
      integrationKeys: INTEGRATION_SCHEMAS.filter((s) => s.key.startsWith("jobs.")).map((s) => ({ key: s.key, title: s.title })),
    });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: Request) {
  try {
    await requireAdmin();
    const input = marketSourceSchema.parse(await request.json());
    return ok(await saveMarketSource(input), { status: input.id ? 200 : 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
