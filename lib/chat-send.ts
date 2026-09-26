import "server-only";

import { createPoll, getThreadForSend, recordMessage, storeMedia, updateMessageStatus, type MessageKind } from "@/lib/chat";
import { sendTelegramMessage, sendTelegramPoll } from "@/lib/telegram";
import { sendUserbotMessage, sendUserbotPoll } from "@/lib/telegram-userbot";
import { getWhatsAppConfig, sendWhatsAppMedia, sendWhatsAppPoll, sendWhatsAppText, uploadWhatsAppMedia } from "@/lib/whatsapp";

function kindForMime(mime: string): MessageKind {
  if (mime.startsWith("image/")) return "image";
  if (mime.startsWith("video/")) return "video";
  if (mime.startsWith("audio/")) return "audio";
  return "file";
}

export async function sendChatMessage(
  threadId: string,
  input: { text?: string; file?: { data: Buffer; mime: string; name: string } },
) {
  const thread = await getThreadForSend(threadId);
  if (!thread) throw new Error("THREAD_NOT_FOUND");
  if (!input.text?.trim() && !input.file) throw new Error("EMPTY_MESSAGE");

  const kind: MessageKind = input.file ? kindForMime(input.file.mime) : "text";
  const mediaId = input.file ? await storeMedia({ mime: input.file.mime, name: input.file.name, data: input.file.data }) : null;

  const messageId = await recordMessage({
    threadId,
    direction: "out",
    kind,
    text: input.text?.trim() || null,
    mediaId,
    mediaMime: input.file?.mime ?? null,
    mediaName: input.file?.name ?? null,
    mediaSize: input.file?.data.length ?? null,
    senderName: "You",
    status: "pending",
  });

  try {
    let externalId: string | null = null;
    if (thread.channel === "telegram_userbot") {
      externalId = (await sendUserbotMessage(threadId, { text: input.text, file: input.file })).externalId;
    } else if (thread.channel === "telegram_bot") {
      if (input.file) throw new Error("Attachments aren't supported on bot-linked Telegram yet.");
      await sendTelegramMessage(thread.peerId, input.text ?? "");
    } else if (thread.channel === "whatsapp") {
      const cfg = await getWhatsAppConfig();
      if (!cfg.configured) throw new Error("WHATSAPP_NOT_CONFIGURED");
      if (input.file) {
        const mid = await uploadWhatsAppMedia(input.file.data, input.file.mime, input.file.name);
        externalId = (await sendWhatsAppMedia(thread.peerId, mid, input.file.mime, { caption: input.text, filename: input.file.name })).externalId;
      } else {
        externalId = (await sendWhatsAppText(thread.peerId, input.text ?? "")).externalId;
      }
    }
    await updateMessageStatus(messageId!, "sent");
    return { id: messageId, externalId, status: "sent" as const };
  } catch (error) {
    const detail = error instanceof Error ? error.message : "send failed";
    if (messageId) await updateMessageStatus(messageId, "failed", detail);
    throw new Error(detail);
  }
}

export async function sendChatPoll(threadId: string, question: string, options: string[], createdBy?: string) {
  const thread = await getThreadForSend(threadId);
  if (!thread) throw new Error("THREAD_NOT_FOUND");
  const clean = options.map((o) => o.trim()).filter(Boolean).slice(0, 10);
  if (!question.trim() || clean.length < 2) throw new Error("A poll needs a question and at least two options.");

  const messageId = await recordMessage({
    threadId,
    direction: "out",
    kind: "system",
    text: `📊 Poll: ${question.trim()}\n${clean.map((o) => `• ${o}`).join("\n")}`,
    senderName: "You",
    status: "pending",
  });

  let externalId: string | null = null;
  try {
    if (thread.channel === "telegram_userbot") {
      externalId = (await sendUserbotPoll(threadId, question.trim(), clean)).externalId;
    } else if (thread.channel === "telegram_bot") {
      externalId = await sendTelegramPoll(thread.peerId, question.trim(), clean);
    } else if (thread.channel === "whatsapp") {
      externalId = await sendWhatsAppPoll(thread.peerId, question.trim(), clean);
    }
    await updateMessageStatus(messageId!, "sent");
    await createPoll({ threadId, messageId, channel: thread.channel, externalId, question, options: clean, createdBy: createdBy ?? null });
    return { id: messageId, externalId };
  } catch (error) {
    const detail = error instanceof Error ? error.message : "poll send failed";
    if (messageId) await updateMessageStatus(messageId, "failed", detail);
    throw new Error(detail);
  }
}
