import { requireAdmin } from "@/lib/admin";
import { fail, handleApiError, ok } from "@/lib/api";
import { query } from "@/lib/db";
import { upsertThread, type ChatChannel } from "@/lib/chat";

export const runtime = "nodejs";

// Linked Aperio users you can message, grouped by user.
export async function GET() {
  try {
    await requireAdmin();
    const rows = await query<Record<string, unknown>>(
      `SELECT u.id AS "userId", u.full_name AS "name", u.email, mc.platform, mc.address, mc.handle
       FROM messaging_channels mc JOIN users u ON u.id = mc.user_id
       WHERE mc.status='linked' AND mc.address IS NOT NULL
       ORDER BY u.full_name`,
    );
    const byUser = new Map<string, Record<string, unknown>>();
    for (const r of rows) {
      const key = String(r.userId);
      if (!byUser.has(key)) byUser.set(key, { userId: r.userId, name: r.name, email: r.email, channels: [] });
      (byUser.get(key)!.channels as unknown[]).push({ platform: r.platform, address: r.address, handle: r.handle });
    }
    return ok({ contacts: [...byUser.values()] });
  } catch (error) {
    return handleApiError(error);
  }
}

// Start (or reopen) a thread with an arbitrary number / handle.
export async function POST(request: Request) {
  try {
    await requireAdmin();
    const body = (await request.json().catch(() => ({}))) as { channel?: string; peer?: string; name?: string };
    const channel = body.channel === "whatsapp" || body.channel === "telegram_userbot" ? (body.channel as ChatChannel) : null;
    if (!channel) return fail("VALIDATION_ERROR", "Choose Telegram or WhatsApp.", 422);

    let peerId = String(body.peer ?? "").trim();
    let peerUsername: string | null = null;
    if (channel === "whatsapp") {
      peerId = peerId.replace(/\D/g, "");
      if (peerId.length < 8) return fail("VALIDATION_ERROR", "Enter a full phone number with country code.", 422);
    } else {
      if (peerId.startsWith("@")) {
        peerUsername = peerId.replace(/^@/, "");
        peerId = peerUsername; // placeholder id; resolution happens by @username on send/sync
      } else {
        peerId = peerId.replace(/\D/g, "");
        if (peerId.length < 6) return fail("VALIDATION_ERROR", "Enter a @username or a phone number.", 422);
      }
    }

    const threadId = await upsertThread({
      channel,
      peerId,
      peerName: body.name?.trim() || (channel === "whatsapp" ? `+${peerId}` : peerUsername ? `@${peerUsername}` : peerId),
      peerUsername,
      peerType: channel === "telegram_userbot" ? "user" : null,
    });
    return ok({ id: threadId }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
