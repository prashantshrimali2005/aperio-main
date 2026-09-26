import { IntegrationForms } from "@/components/admin/integration-forms";
import { requireAdminPage } from "@/lib/admin";
import { isEncryptionConfigured } from "@/lib/crypto";
import { INTEGRATION_SCHEMAS, getIntegrationForAdmin } from "@/lib/settings";

export const metadata = { title: "Admin · Integrations" };

export default async function AdminIntegrationsPage() {
  await requireAdminPage();
  const integrations = await Promise.all(INTEGRATION_SCHEMAS.map((schema) => getIntegrationForAdmin(schema.key)));
  return <IntegrationForms integrations={integrations as never} encryptionReady={isEncryptionConfigured()} />;
}
