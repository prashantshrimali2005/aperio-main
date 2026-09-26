import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { fail, handleApiError } from "@/lib/api";
import { one, query } from "@/lib/db";
import { getMedia, storeMedia } from "@/lib/chat";
import { downloadWhatsAppMedia } from "@/lib/whatsapp";
import { idSchema } from "@/lib/validation";

export const runtime = "nodejs";
export const maxDuration = 60;

/** `id` is a chat_messages.id. Serves stored media, lazily fetching WhatsApp media on first view. */
export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin();
    const messageId = idSchema.parse((await context.params).id);
    const download = new URL(request.url).searchParams.get("download") === "1";
    const disposition = (name: string) => `${download ? "attachment" : "inline"}; filename="${(name || "file").replace(/"/g, "")}"`;

    const msg = await one<{ mediaId: string | null; providerRef: Record<string, unknown> | null; mediaMime: string | null; mediaName: string | null }>(
      `SELECT media_id AS "mediaId", provider_ref AS "providerRef", media_mime AS "mediaMime", media_name AS "mediaName"
       FROM chat_messages WHERE id=$1`,
      [messageId],
    );
    if (!msg) return fail("NOT_FOUND", "Message not found.", 404);

    let mediaId = msg.mediaId;
    if (!mediaId) {
      const waMediaId = (msg.providerRef as { waMediaId?: string } | null)?.waMediaId;
      if (!waMediaId) return fail("NO_MEDIA", "This message has no downloadable media.", 404);
      const { data, mime } = await downloadWhatsAppMedia(waMediaId);
      mediaId = await storeMedia({ mime: msg.mediaMime || mime, name: msg.mediaName, data });
      if (mediaId) await query(`UPDATE chat_messages SET media_id=$2, media_size=$3 WHERE id=$1`, [messageId, mediaId, data.length]);
      else {
        return new NextResponse(new Uint8Array(data), {
          headers: { "content-type": msg.mediaMime || mime, "content-disposition": disposition(msg.mediaName || ""), "cache-control": "private, max-age=3600" },
        });
      }
    }

    const media = await getMedia(mediaId);
    if (!media) return fail("NOT_FOUND", "Media not found.", 404);
    return new NextResponse(new Uint8Array(media.data), {
      headers: {
        "content-type": media.mime,
        "content-disposition": disposition(media.name || ""),
        "cache-control": "private, max-age=86400",
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
