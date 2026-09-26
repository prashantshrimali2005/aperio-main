import { requireAdmin } from "@/lib/admin";
import { fail, handleApiError, ok } from "@/lib/api";
import { getIntegrationRuntime, schemaFor } from "@/lib/settings";
import { sendTestEmail } from "@/lib/email";
import { pingGemini } from "@/lib/gemini";
import { telegramGetMe } from "@/lib/telegram";
import { testUserbot } from "@/lib/telegram-userbot";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(_: Request, context: { params: Promise<{ key: string }> }) {
  try {
    const admin = await requireAdmin();
    const key = (await context.params).key;
    if (!schemaFor(key)) return fail("NOT_FOUND", "Unknown integration.", 404);

    if (key === "email.smtp") {
      try {
        await sendTestEmail(admin.email);
        return ok({ ok: true, detail: `Test email sent to ${admin.email}. Check your inbox — then tick Enabled + Save to turn on notification emails.` });
      } catch (error) {
        const msg = error instanceof Error ? error.message : "Send failed.";
        if (msg === "EMAIL_NOT_CONFIGURED") return ok({ ok: false, detail: "Fill the SMTP host, username, and password, then Save first." });
        return ok({ ok: false, detail: msg });
      }
    }

    if (key === "assistant") {
      const rt = await getIntegrationRuntime("assistant");
      const enabled = rt.enabled;
      const linkedOnly = String(rt.config.linkedOnly ?? "true") !== "false";
      try {
        const { model, text } = await pingGemini();
        const scope = linkedOnly ? "only signed-up users" : "everyone who messages";
        return ok({
          ok: true,
          detail: `Gemini reachable via ${model}${text ? ` (said "${text}")` : ""}. Auto-reply is ${enabled ? "ON" : "OFF"}, replying to ${scope}.`,
        });
      } catch (error) {
        const msg = error instanceof Error ? error.message : "Gemini request failed.";
        if (msg === "GEMINI_NOT_CONFIGURED") return ok({ ok: false, detail: "Set GEMINI_API_KEY in the environment first." });
        return ok({ ok: false, detail: msg });
      }
    }

    if (key === "telegram.bot") {
      try {
        const me = await telegramGetMe();
        return ok({ ok: true, detail: me.username ? `Connected as @${me.username}` : "Bot token accepted." });
      } catch (error) {
        return ok({ ok: false, detail: error instanceof Error ? error.message : "Telegram rejected the token." });
      }
    }

    if (key === "telegram.userbot") {
      return ok(await testUserbot());
    }

    if (key === "whatsapp.cloud") {
      const runtime = await getIntegrationRuntime("whatsapp.cloud");
      const phoneNumberId = runtime.config.phoneNumberId;
      const token = runtime.secret("accessToken");
      if (!phoneNumberId || !token) return ok({ ok: false, detail: "Add the phone number ID and access token first." });
      try {
        const res = await fetch(`https://graph.facebook.com/v21.0/${phoneNumberId}?fields=verified_name,display_phone_number`, {
          headers: { authorization: `Bearer ${token}` },
        });
        const json = (await res.json()) as { verified_name?: string; display_phone_number?: string; error?: { message?: string } };
        if (!res.ok) return ok({ ok: false, detail: json.error?.message || `HTTP ${res.status}` });
        return ok({ ok: true, detail: `${json.verified_name ?? "Number"} · ${json.display_phone_number ?? phoneNumberId}` });
      } catch (error) {
        return ok({ ok: false, detail: error instanceof Error ? error.message : "Request failed." });
      }
    }

    if (key === "jobs.arbeitnow") {
      try {
        const res = await fetch("https://www.arbeitnow.com/api/job-board-api?page=1");
        const json = (await res.json()) as { data?: unknown[] };
        if (!res.ok) return ok({ ok: false, detail: `HTTP ${res.status}` });
        return ok({ ok: true, detail: `Reachable · ${json.data?.length ?? 0} postings on page 1. No key needed.` });
      } catch (error) {
        return ok({ ok: false, detail: error instanceof Error ? error.message : "Request failed." });
      }
    }

    return ok({ ok: false, detail: "No connection test for this integration. Credentials are stored." });
  } catch (error) {
    return handleApiError(error);
  }
}
