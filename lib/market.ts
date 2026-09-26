import { randomUUID } from "node:crypto";
import { one, query } from "@/lib/db";
import type { Importance } from "@/lib/types";

/**
 * Aperio keeps two clearly separated demand signals:
 *
 *  1. In-catalog leverage (this file, `getRoleLeverage`) — computed only from
 *     seeded role/skill data. It answers "how transferable is this skill across
 *     the roles Aperio tracks?" No external data, no fabrication.
 *
 *  2. Live market outlook (`getMarketOutlook`) — reads the `market_signals`
 *     table, which is EMPTY until a real job-postings source is ingested via
 *     `scripts/ingest-market.ts`. With no rows we report `connected: false` and
 *     never invent numbers or a forecast. A projection is only returned when at
 *     least two real dated observations exist for a skill.
 *
 * Neither signal changes an analysis score or classification — that boundary is
 * deterministic and evidence-based (see docs/ANALYSIS_ARCHITECTURE.md).
 */

const IMPORTANCE_WEIGHT: Record<Importance, number> = { critical: 3, high: 2, medium: 1, optional: 0.5 };

export interface SkillLeverage {
  skillId: string;
  name: string;
  skillType: "technical" | "soft";
  roleCount: number;
  criticalCount: number;
  leverageIndex: number; // 0-100, relative to the most in-demand skill in the catalog
}

export async function getRoleLeverage(roleId: string, experienceLevel: string): Promise<SkillLeverage[]> {
  const rows = await query<{
    skillId: string;
    name: string;
    skillType: "technical" | "soft";
    roleCount: number;
    criticalCount: number;
    demandScore: number;
    maxDemandScore: number;
  } & Record<string, unknown>>(
    `WITH catalog AS (
       SELECT r.skill_id,
         COUNT(DISTINCT r.role_id) AS role_count,
         COUNT(DISTINCT r.role_id) FILTER (WHERE r.importance = 'critical') AS critical_count,
         SUM(CASE r.importance
               WHEN 'critical' THEN ${IMPORTANCE_WEIGHT.critical}
               WHEN 'high' THEN ${IMPORTANCE_WEIGHT.high}
               WHEN 'medium' THEN ${IMPORTANCE_WEIGHT.medium}
               ELSE ${IMPORTANCE_WEIGHT.optional} END) AS demand_score
       FROM role_skill_requirements r
       JOIN roles ro ON ro.id = r.role_id AND ro.active = true
       WHERE r.experience_level = $2
       GROUP BY r.skill_id
     )
     SELECT s.id AS "skillId", s.name, s.skill_type AS "skillType",
       c.role_count AS "roleCount", c.critical_count AS "criticalCount",
       c.demand_score AS "demandScore",
       (SELECT MAX(demand_score) FROM catalog) AS "maxDemandScore"
     FROM role_skill_requirements rr
     JOIN skills s ON s.id = rr.skill_id
     JOIN catalog c ON c.skill_id = rr.skill_id
     WHERE rr.role_id = $1 AND rr.experience_level = $2
     ORDER BY c.demand_score DESC, s.name`,
    [roleId, experienceLevel],
  );

  return rows.map((row) => ({
    skillId: row.skillId,
    name: row.name,
    skillType: row.skillType,
    roleCount: Number(row.roleCount),
    criticalCount: Number(row.criticalCount),
    leverageIndex: row.maxDemandScore ? Math.round((Number(row.demandScore) / Number(row.maxDemandScore)) * 100) : 0,
  }));
}

export interface MarketSignal {
  skillId: string;
  region: string;
  demandIndex: number | null;
  postingCount: number | null;
  trend: "rising" | "steady" | "declining" | "unknown";
  yoyChange: number | null;
  capturedAt: string;
  source: string;
}

export interface MarketProjection {
  skillId: string;
  horizonDays: number;
  projectedDemandIndex: number;
  slopePerDay: number;
  basis: number; // number of real observations the projection is built from
}

export interface MarketOutlook {
  connected: boolean;
  signals: MarketSignal[];
  projections: MarketProjection[];
  note: string;
}

/** Least-squares slope over real (t, value) points. Returns null with < 2 points. */
function linearProjection(points: Array<{ t: number; v: number }>, horizonDays: number) {
  if (points.length < 2) return null;
  const n = points.length;
  const meanT = points.reduce((s, p) => s + p.t, 0) / n;
  const meanV = points.reduce((s, p) => s + p.v, 0) / n;
  let num = 0;
  let den = 0;
  for (const p of points) {
    num += (p.t - meanT) * (p.v - meanV);
    den += (p.t - meanT) ** 2;
  }
  if (den === 0) return null;
  const slopePerMs = num / den;
  const latest = points[points.length - 1];
  const projected = latest.v + slopePerMs * horizonDays * 86_400_000;
  return {
    slopePerDay: slopePerMs * 86_400_000,
    projectedDemandIndex: Math.max(0, Math.min(100, Math.round(projected))),
  };
}

export async function getMarketOutlook(skillIds: string[], region = "global", horizonDays = 180): Promise<MarketOutlook> {
  if (!skillIds.length) {
    return { connected: false, signals: [], projections: [], note: "No skills to look up." };
  }

  const rows = await query<{
    skillId: string;
    region: string;
    demandIndex: string | null;
    postingCount: number | null;
    trend: MarketSignal["trend"];
    yoyChange: string | null;
    capturedAt: string;
    source: string;
    sourceId: string | null;
    weight: string | null;
  } & Record<string, unknown>>(
    `SELECT ms.skill_id AS "skillId", ms.region, ms.demand_index AS "demandIndex", ms.posting_count AS "postingCount",
      ms.trend, ms.yoy_change AS "yoyChange", ms.captured_at AS "capturedAt", ms.source,
      ms.source_id AS "sourceId", COALESCE(src.weight, 1) AS weight
     FROM market_signals ms
     LEFT JOIN market_sources src ON src.id = ms.source_id
     WHERE ms.skill_id = ANY($1::text[]) AND ms.region = $2 AND (src.enabled IS DISTINCT FROM false)
     ORDER BY ms.skill_id, ms.captured_at ASC`,
    [skillIds, region],
  );

  if (!rows.length) {
    return {
      connected: false,
      signals: [],
      projections: [],
      note: "Live market data is not connected. Configure a job-postings source under Admin → Job market, then ingest with scripts/ingest-market.ts.",
    };
  }

  const bySkill = new Map<string, Array<(typeof rows)[number]>>();
  for (const row of rows) {
    const list = bySkill.get(row.skillId) ?? [];
    list.push(row);
    bySkill.set(row.skillId, list);
  }

  const signals: MarketSignal[] = [];
  const projections: MarketProjection[] = [];

  for (const [skillId, history] of bySkill) {
    // Latest value per source, then a weight-blended demand index.
    const latestBySource = new Map<string, (typeof history)[number]>();
    for (const row of history) latestBySource.set(row.sourceId ?? "__none__", row);
    const latestRows = [...latestBySource.values()];
    let wSum = 0;
    let wDemand = 0;
    for (const row of latestRows) {
      if (row.demandIndex === null) continue;
      const w = Number(row.weight ?? 1);
      wSum += w;
      wDemand += w * Number(row.demandIndex);
    }
    const latest = history[history.length - 1];
    signals.push({
      skillId,
      region: latest.region,
      demandIndex: wSum ? Math.round(wDemand / wSum) : null,
      postingCount: latestRows.reduce((sum, row) => sum + (row.postingCount ?? 0), 0) || null,
      trend: latest.trend,
      yoyChange: latest.yoyChange === null ? null : Number(latest.yoyChange),
      capturedAt: latest.capturedAt,
      source: latestRows.length > 1 ? `${latestRows.length} sources (weighted)` : latest.source,
    });

    // Weighted mean per capture date, oldest→newest, for the projection.
    const byDate = new Map<string, { t: number; wSum: number; wVal: number }>();
    for (const row of history) {
      if (row.demandIndex === null) continue;
      const day = row.capturedAt.slice(0, 10);
      const w = Number(row.weight ?? 1);
      const bucket = byDate.get(day) ?? { t: new Date(row.capturedAt).getTime(), wSum: 0, wVal: 0 };
      bucket.wSum += w;
      bucket.wVal += w * Number(row.demandIndex);
      byDate.set(day, bucket);
    }
    const points = [...byDate.values()]
      .filter((b) => b.wSum > 0)
      .map((b) => ({ t: b.t, v: b.wVal / b.wSum }))
      .sort((a, b) => a.t - b.t);
    const projected = linearProjection(points, horizonDays);
    if (projected) {
      projections.push({
        skillId,
        horizonDays,
        projectedDemandIndex: projected.projectedDemandIndex,
        slopePerDay: Number(projected.slopePerDay.toFixed(4)),
        basis: points.length,
      });
    }
  }

  return {
    connected: true,
    signals,
    projections,
    note: `Based on ${rows.length} real observations from job-postings ingestion. Forecasts are a linear projection of past data, not a guarantee.`,
  };
}

// --- admin: weighted job-market sources -------------------------------------

export interface MarketSource {
  id: string;
  name: string;
  kind: "api" | "agency" | "manual";
  weight: number;
  integrationKey: string | null;
  region: string;
  enabled: boolean;
  config: Record<string, unknown>;
  createdAt: string;
}

export async function listMarketSources() {
  return query<MarketSource & Record<string, unknown>>(
    `SELECT s.id, s.name, s.kind, s.weight, s.integration_key AS "integrationKey", s.region, s.enabled,
       s.config, s.created_at AS "createdAt",
       (SELECT count(*) FROM market_signals ms WHERE ms.source_id = s.id) AS observations
     FROM market_sources s ORDER BY s.weight DESC, s.name`,
  );
}

export async function saveMarketSource(input: {
  id?: string;
  name: string;
  kind?: MarketSource["kind"];
  weight?: number;
  integrationKey?: string | null;
  region?: string;
  enabled?: boolean;
  config?: Record<string, unknown>;
}) {
  const id = input.id ?? randomUUID();
  await query(
    `INSERT INTO market_sources (id, name, kind, weight, integration_key, region, enabled, config)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb)
     ON CONFLICT (id) DO UPDATE SET name=EXCLUDED.name, kind=EXCLUDED.kind, weight=EXCLUDED.weight,
       integration_key=EXCLUDED.integration_key, region=EXCLUDED.region, enabled=EXCLUDED.enabled, config=EXCLUDED.config`,
    [
      id,
      input.name.slice(0, 120),
      input.kind ?? "api",
      Math.max(0, Math.min(10, Number(input.weight ?? 1))),
      input.integrationKey || null,
      (input.region ?? "global").slice(0, 40),
      input.enabled ?? true,
      JSON.stringify(input.config ?? {}),
    ],
  );
  return one("SELECT * FROM market_sources WHERE id=$1", [id]);
}

export async function deleteMarketSource(id: string) {
  await query("DELETE FROM market_sources WHERE id=$1", [id]);
}
