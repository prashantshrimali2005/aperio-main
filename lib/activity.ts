import "server-only";

import { randomUUID } from "node:crypto";
import { headers } from "next/headers";
import { query } from "@/lib/db";

export type ActivityAction =
  | "auth.register"
  | "auth.login"
  | "auth.login.google"
  | "auth.logout"
  | "resume.upload"
  | "resume.rejected"
  | "analysis.run"
  | "roadmap.update"
  | "learning_path.generate"
  | "learning_module.update"
  | "channel.link"
  | "channel.unlink"
  | "notification.batch"
  | "admin.integration.save"
  | "profile.update";

interface LogInput {
  action: ActivityAction;
  userId?: string | null;
  actorEmail?: string | null;
  entityType?: string;
  entityId?: string;
  metadata?: Record<string, unknown>;
  request?: Request;
}

async function clientMeta(request?: Request) {
  try {
    const h = request ? request.headers : await headers();
    const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || null;
    const ua = h.get("user-agent")?.slice(0, 400) || null;
    return { ip, ua };
  } catch {
    return { ip: null, ua: null };
  }
}

/** Fire-and-forget: never let telemetry break the request path. */
export async function logActivity(input: LogInput) {
  try {
    const { ip, ua } = await clientMeta(input.request);
    await query(
      `INSERT INTO activity_events (id, user_id, actor_email, action, entity_type, entity_id, metadata, ip, user_agent)
       VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb,$8,$9)`,
      [
        randomUUID(),
        input.userId ?? null,
        input.actorEmail?.toLowerCase() ?? null,
        input.action,
        input.entityType ?? null,
        input.entityId ?? null,
        JSON.stringify(input.metadata ?? {}),
        ip,
        ua,
      ],
    );
  } catch (error) {
    console.error("logActivity failed", error instanceof Error ? error.message : "unknown error");
  }
}

export async function touchLastSeen(userId: string) {
  try {
    await query("UPDATE users SET last_seen_at=now() WHERE id=$1", [userId]);
  } catch {
    /* non-critical */
  }
}
