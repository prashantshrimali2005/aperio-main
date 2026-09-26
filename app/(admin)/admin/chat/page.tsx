import { ChatWorkspace } from "@/components/admin/chat-workspace";
import { requireAdminPage } from "@/lib/admin";
import { listThreads } from "@/lib/chat";
import { getWhatsAppConfig } from "@/lib/whatsapp";
import { userbotStatus } from "@/lib/telegram-userbot";

export const metadata = { title: "Admin · Chat" };

export default async function AdminChatPage() {
  await requireAdminPage();
  const [threads, wa, tg] = await Promise.all([listThreads({}), getWhatsAppConfig(), userbotStatus()]);
  return <ChatWorkspace initialThreads={threads as never} telegramReady={tg.loggedIn} whatsappReady={wa.configured} />;
}
