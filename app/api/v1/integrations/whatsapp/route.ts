import { requireUser } from "@/lib/auth";
import { handleApiError, ok } from "@/lib/api";
import { query } from "@/lib/db";

export const runtime = "nodejs";

export async function DELETE() {
  try {
    const user = await requireUser();
    await query(
      `UPDATE messaging_channels
       SET status='disabled', address=NULL, link_code=NULL, link_code_expires_at=NULL, updated_at=now()
       WHERE user_id=$1 AND platform='whatsapp'`,
      [user.id],
    );
    return ok({ platform: "whatsapp", status: "disabled" });
  } catch (error) {
    return handleApiError(error);
  }
}
