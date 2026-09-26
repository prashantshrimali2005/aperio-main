import { requireAdmin } from "@/lib/admin";
import { fail, handleApiError, ok } from "@/lib/api";
import { logActivity } from "@/lib/activity";
import { isEncryptionConfigured } from "@/lib/crypto";
import { getIntegrationForAdmin, saveIntegration, schemaFor, type IntegrationKey } from "@/lib/settings";

export const runtime = "nodejs";

export async function GET(_: Request, context: { params: Promise<{ key: string }> }) {
  try {
    await requireAdmin();
    const key = (await context.params).key;
    if (!schemaFor(key)) return fail("NOT_FOUND", "Unknown integration.", 404);
    return ok(await getIntegrationForAdmin(key as IntegrationKey));
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PUT(request: Request, context: { params: Promise<{ key: string }> }) {
  try {
    const admin = await requireAdmin();
    const key = (await context.params).key;
    if (!schemaFor(key)) return fail("NOT_FOUND", "Unknown integration.", 404);
    if (!isEncryptionConfigured()) {
      return fail("ENCRYPTION_NOT_CONFIGURED", "Set APP_ENCRYPTION_KEY before storing credentials.", 503);
    }
    const body = (await request.json().catch(() => ({}))) as {
      config?: Record<string, string>;
      secrets?: Record<string, string>;
      enabled?: boolean;
    };
    const saved = await saveIntegration(
      key as IntegrationKey,
      { config: body.config, secrets: body.secrets, enabled: body.enabled },
      admin.email,
    );
    await logActivity({ action: "admin.integration.save", userId: admin.id, actorEmail: admin.email, entityType: "integration", entityId: key, metadata: { enabled: saved.enabled }, request });
    return ok(saved);
  } catch (error) {
    return handleApiError(error);
  }
}
