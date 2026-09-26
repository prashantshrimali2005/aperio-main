import { query } from "@/lib/db";
import { getEmailConfig } from "@/lib/email";
import { getTelegramConfig } from "@/lib/telegram";
import { userbotStatus } from "@/lib/telegram-userbot";
import { getWhatsAppConfig } from "@/lib/whatsapp";

export interface IntegrationsState {
  channels: Array<{
    platform: "telegram" | "whatsapp";
    status: "pending" | "linked" | "disabled";
    handle: string | null;
    hasAddress: boolean;
    linkCode: string | null;
  }>;
  email: string;
  preferences: {
    notifyRoadmap: boolean;
    notifyWeeklyDigest: boolean;
    notifyAnalysis: boolean;
    notifyInactivity: boolean;
    notifyEmail: boolean;
  };
  providers: {
    telegram: { configured: boolean; botUsername: string };
    whatsapp: { configured: boolean; businessNumber: string };
    email: { configured: boolean; provider: string | null };
  };
}

export async function getIntegrationsState(userId: string): Promise<IntegrationsState> {
  const channels = await query<IntegrationsState["channels"][number] & Record<string, unknown>>(
    `SELECT platform, status, handle, address IS NOT NULL AS "hasAddress", link_code AS "linkCode"
     FROM messaging_channels WHERE user_id=$1 ORDER BY platform`,
    [userId],
  );
  const prefs = await query<Record<string, unknown>>(
    `SELECT u.email, COALESCE(p.notify_roadmap, true) AS "notifyRoadmap",
      COALESCE(p.notify_weekly_digest, true) AS "notifyWeeklyDigest",
      COALESCE(p.notify_analysis, true) AS "notifyAnalysis",
      COALESCE(p.notify_inactivity, true) AS "notifyInactivity",
      COALESCE(p.notify_email, true) AS "notifyEmail"
     FROM users u LEFT JOIN preferences p ON p.user_id = u.id WHERE u.id=$1`,
    [userId],
  );
  const [telegram, whatsapp, email, userbot] = await Promise.all([getTelegramConfig(), getWhatsAppConfig(), getEmailConfig(), userbotStatus()]);
  const row = prefs[0] ?? {};
  return {
    channels,
    email: String(row.email ?? ""),
    preferences: {
      notifyRoadmap: Boolean(row.notifyRoadmap ?? true),
      notifyWeeklyDigest: Boolean(row.notifyWeeklyDigest ?? true),
      notifyAnalysis: Boolean(row.notifyAnalysis ?? true),
      notifyInactivity: Boolean(row.notifyInactivity ?? true),
      notifyEmail: Boolean(row.notifyEmail ?? true),
    },
    providers: {
      telegram: { configured: telegram.configured || userbot.loggedIn, botUsername: userbot.loggedIn && userbot.username ? userbot.username : telegram.botUsername },
      whatsapp: { configured: whatsapp.configured, businessNumber: whatsapp.businessNumber },
      email: { configured: email.provider !== null, provider: email.provider },
    },
  };
}
