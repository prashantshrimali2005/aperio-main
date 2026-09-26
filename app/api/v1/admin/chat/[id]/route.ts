import { requireAdmin } from "@/lib/admin";
import { fail, handleApiError, ok } from "@/lib/api";
import { logActivity } from "@/lib/activity";
import { getMessages, getThread, markThreadRead, reapStalePendingOutbound } from "@/lib/chat";
import { sendChatMessage } from "@/lib/chat-send";
import { idSchema } from "@/lib/validation";

export const runtime = "nodejs";
export const maxDuration = 60;

const MAX_UPLOAD = 20 * 1024 * 1024;

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin();
    const id = idSchema.parse((await context.params).id);
    const thread = await getThread(id);
    if (!thread) return fail("NOT_FOUND", "Thread not found.", 404);
    await reapStalePendingOutbound(id);
    const params = new URL(request.url).searchParams;
    const messages = await getMessages(id, {
      sinceId: params.get("sinceId") || undefined,
      beforeId: params.get("beforeId") || undefined,
      limit: params.get("limit") ? Number(params.get("limit")) : undefined,
    });
    if (params.get("markRead") === "1") await markThreadRead(id);
    return ok({ thread, messages });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const admin = await requireAdmin();
    const id = idSchema.parse((await context.params).id);

    let text: string | undefined;
    let file: { data: Buffer; mime: string; name: string } | undefined;

    const contentType = request.headers.get("content-type") ?? "";
    if (contentType.includes("multipart/form-data")) {
      const form = await request.formData();
      text = (form.get("text") as string | null)?.toString();
      const f = form.get("file");
      if (f instanceof File && f.size > 0) {
        if (f.size > MAX_UPLOAD) return fail("FILE_TOO_LARGE", "Files must be 20 MB or smaller.", 422);
        file = { data: Buffer.from(await f.arrayBuffer()), mime: f.type || "application/octet-stream", name: f.name || "file" };
      }
    } else {
      const body = (await request.json().catch(() => ({}))) as { text?: string };
      text = body.text;
    }

    const result = await sendChatMessage(id, { text, file });
    await logActivity({ action: "admin.integration.save", userId: admin.id, actorEmail: admin.email, entityType: "chat", entityId: id, metadata: { kind: file ? "media" : "text" }, request });
    return ok(result, { status: 201 });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "THREAD_NOT_FOUND") return fail("NOT_FOUND", "Thread not found.", 404);
      if (error.message === "EMPTY_MESSAGE") return fail("VALIDATION_ERROR", "Type a message or attach a file.", 422);
      if (error.message === "USERBOT_NOT_LOGGED_IN") return fail("PROVIDER", "The Telegram user bot is not logged in.", 503);
      return fail("SEND_FAILED", error.message, 502);
    }
    return handleApiError(error);
  }
}
