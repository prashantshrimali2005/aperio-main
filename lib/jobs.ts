import { randomUUID } from "node:crypto";
import { one, query } from "@/lib/db";

const POSTING_TTL_DAYS = 45;

function escapeRe(v: string) {
  return v.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// Neon's HTTP driver is one request per query and can drop a long run of them.
async function run(text: string, params: unknown[] = []) {
  for (let attempt = 1; ; attempt += 1) {
    try {
      return await query(text, params);
    } catch (error) {
      const code =
        (error as { code?: string; cause?: { code?: string } })?.code ??
        (error as { cause?: { code?: string } })?.cause?.code;
      const transient = ["UND_ERR_CONNECT_TIMEOUT", "ECONNRESET", "ETIMEDOUT", "EPIPE", "UND_ERR_SOCKET"].includes(code ?? "");
      if (!transient || attempt >= 5) throw error;
      await new Promise((resolve) => setTimeout(resolve, attempt * 700));
    }
  }
}

function placeholders(rows: number, cols: number) {
  return Array.from({ length: rows }, (_, r) => `(${Array.from({ length: cols }, (_, c) => `$${r * cols + c + 1}`).join(",")})`).join(",");
}

async function batchInsert(table: string, columns: string[], rows: unknown[][], onConflict: string, chunk = 40) {
  for (let i = 0; i < rows.length; i += chunk) {
    const slice = rows.slice(i, i + chunk);
    await run(
      `INSERT INTO ${table} (${columns.join(",")}) VALUES ${placeholders(slice.length, columns.length)} ${onConflict}`,
      slice.flat(),
    );
  }
}

interface ArbeitnowJob {
  slug?: string;
  title?: string;
  company_name?: string;
  description?: string;
  remote?: boolean;
  url?: string;
  tags?: string[];
  job_types?: string[];
  location?: string;
  created_at?: number;
}

async function skillMatchers() {
  const skills = await query<{ id: string; name: string; aliases: string[] } & Record<string, unknown>>(
    "SELECT id, name, aliases FROM skills",
  );
  return skills.map((s) => ({
    id: s.id,
    patterns: [s.name, ...(s.aliases ?? [])]
      .filter((a) => a && a.length > 2)
      .map((a) => new RegExp(`(^|[^a-z0-9+])${escapeRe(a.toLowerCase())}([^a-z0-9+]|$)`)),
  }));
}

/**
 * One pass over every enabled Arbeitnow source: store the actual postings (with
 * the catalog skills each one mentions) AND a dated demand observation per skill.
 * No fabricated data — a source with nothing reachable writes nothing.
 */
export async function runJobIngestion() {
  const sources = await query<{ id: string; name: string; integrationKey: string | null; config: Record<string, unknown>; region: string } & Record<string, unknown>>(
    `SELECT id, name, integration_key AS "integrationKey", config, region FROM market_sources WHERE enabled = true`,
  );
  if (!sources.length) return { sources: 0, postings: 0, observations: 0, note: "No enabled job sources. Add one in Admin → Job market." };

  const matchers = await skillMatchers();
  let postings = 0;
  let observations = 0;
  const details: string[] = [];

  for (const source of sources) {
    if (source.integrationKey !== "jobs.arbeitnow") {
      details.push(`skip ${source.name} (no ingester for ${source.integrationKey ?? "none"})`);
      continue;
    }
    const pages = Math.max(1, Math.min(20, Number(source.config?.pages ?? 5)));
    const remoteOnly = String(source.config?.remoteOnly ?? "").toLowerCase() === "true";

    const jobs: ArbeitnowJob[] = [];
    for (let page = 1; page <= pages; page += 1) {
      const res = await fetch(`https://www.arbeitnow.com/api/job-board-api?page=${page}`, { headers: { accept: "application/json" } });
      if (!res.ok) break;
      const json = (await res.json()) as { data?: ArbeitnowJob[] };
      const batch = json.data ?? [];
      if (!batch.length) break;
      jobs.push(...batch);
    }
    if (!jobs.length) {
      details.push(`${source.name}: no postings`);
      continue;
    }

    const counts = new Map<string, number>();
    let scanned = 0;
    const postingRows: unknown[][] = [];

    for (const job of jobs) {
      if (remoteOnly && !job.remote) continue;
      if (!job.slug || !job.title) continue;
      scanned += 1;

      const haystack = [job.title, (job.tags ?? []).join(" "), (job.job_types ?? []).join(" "), job.location, job.description ?? ""]
        .filter(Boolean)
        .join(" ")
        .replace(/<[^>]+>/g, " ")
        .toLowerCase();

      const matched: string[] = [];
      for (const m of matchers) {
        if (m.patterns.some((p) => p.test(haystack))) {
          matched.push(m.id);
          counts.set(m.id, (counts.get(m.id) ?? 0) + 1);
        }
      }

      const description = (job.description ?? "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 4000);
      postingRows.push([
        randomUUID(), source.id, source.name, job.slug, job.title.slice(0, 300),
        (job.company_name ?? "").slice(0, 200) || null, (job.location ?? "").slice(0, 200) || null,
        Boolean(job.remote), (job.url ?? "").slice(0, 500) || null, description,
        (job.tags ?? []).slice(0, 30), matched,
        job.created_at ? new Date(job.created_at * 1000).toISOString() : null,
      ]);
      postings += 1;
    }

    await batchInsert(
      "job_postings",
      ["id", "source_id", "source_name", "external_id", "title", "company", "location", "remote", "url", "description", "tags", "skill_ids", "posted_at"],
      postingRows,
      `ON CONFLICT (external_id) DO UPDATE SET
         title=EXCLUDED.title, company=EXCLUDED.company, location=EXCLUDED.location, remote=EXCLUDED.remote,
         url=EXCLUDED.url, description=EXCLUDED.description, tags=EXCLUDED.tags, skill_ids=EXCLUDED.skill_ids, captured_at=now()`,
    );

    const signalRows = [...counts.entries()].map(([skillId, count]) => [
      randomUUID(), skillId, source.region,
      Math.round(Math.min(100, (count / Math.max(scanned, 1)) * 100)), count, "unknown", 30, source.name, source.id,
    ]);
    await batchInsert(
      "market_signals",
      ["id", "skill_id", "region", "demand_index", "posting_count", "trend", "horizon_days", "source", "source_id"],
      signalRows,
      "",
    );
    observations += signalRows.length;
    details.push(`${source.name}: ${scanned} postings scanned, ${counts.size} skills`);
  }

  await run(`DELETE FROM job_postings WHERE captured_at < now() - ($1 || ' days')::interval`, [String(POSTING_TTL_DAYS)]);
  return { sources: sources.length, postings, observations, details };
}

// --- user-facing feed --------------------------------------------------------

export interface JobFilters {
  scope?: "have" | "target" | "all";
  remote?: boolean;
  q?: string;
  limit?: number;
  offset?: number;
}

/** Skills to match against: what the user demonstrates, plus their target-role needs. */
async function userSkillSet(userId: string, scope: JobFilters["scope"]) {
  const have = await query<{ skillId: string }>(
    `SELECT DISTINCT skill_id AS "skillId" FROM (
       SELECT skill_id FROM user_skills WHERE user_id=$1 AND level >= 2
       UNION
       SELECT ar.skill_id FROM analysis_skill_results ar
       JOIN analyses a ON a.id=ar.analysis_id AND a.user_id=$1
       WHERE ar.classification <> 'missing'
         AND a.created_at = (SELECT max(created_at) FROM analyses WHERE user_id=$1)
     ) s`,
    [userId],
  );
  const target = await query<{ skillId: string }>(
    `SELECT rsr.skill_id AS "skillId"
     FROM profiles p
     JOIN role_skill_requirements rsr ON rsr.role_id = p.target_role_id
       AND rsr.experience_level = COALESCE(p.target_level, 'mid')
     WHERE p.user_id=$1`,
    [userId],
  );
  const haveSet = new Set(have.map((r) => r.skillId));
  const targetSet = new Set(target.map((r) => r.skillId));
  if (scope === "have") return haveSet;
  if (scope === "target") return targetSet;
  return new Set([...haveSet, ...targetSet]);
}

export async function getJobsForUser(userId: string, filters: JobFilters = {}) {
  const skillSet = await userSkillSet(userId, filters.scope ?? "all");
  const skillIds = [...skillSet];
  const limit = Math.min(60, Math.max(1, filters.limit ?? 24));
  const offset = Math.max(0, filters.offset ?? 0);
  const like = filters.q ? `%${filters.q.toLowerCase()}%` : null;

  const rows = await query<Record<string, unknown>>(
    `SELECT j.id, j.title, j.company, j.location, j.remote, j.url, j.source_name AS "sourceName",
       j.tags, j.skill_ids AS "skillIds", j.posted_at AS "postedAt", j.captured_at AS "capturedAt",
       LEFT(j.description, 320) AS "descriptionPreview",
       cardinality(ARRAY(SELECT unnest(j.skill_ids) INTERSECT SELECT unnest($1::text[]))) AS "matchCount"
     FROM job_postings j
     WHERE ($1::text[] = '{}' OR j.skill_ids && $1::text[])
       AND ($2::boolean IS NULL OR j.remote = $2)
       AND ($3::text IS NULL OR lower(j.title) LIKE $3 OR lower(COALESCE(j.company,'')) LIKE $3 OR lower(COALESCE(j.location,'')) LIKE $3)
     ORDER BY "matchCount" DESC, j.captured_at DESC
     LIMIT $4 OFFSET $5`,
    [skillIds, filters.remote ?? null, like, limit, offset],
  );

  // resolve matched skill names for chips
  const nameRows = await query<{ id: string; name: string }>(`SELECT id, name FROM skills`);
  const nameById = new Map(nameRows.map((r) => [r.id, r.name]));

  const jobs = rows.map((j) => {
    const jobSkills = (j.skillIds as string[]) ?? [];
    const matched = jobSkills.filter((id) => skillSet.has(id)).map((id) => nameById.get(id)).filter(Boolean);
    return { ...j, matchedSkills: matched, totalSkills: jobSkills.length };
  });

  const [{ count }] = await query<{ count: number }>(
    `SELECT count(*)::int AS count FROM job_postings j
     WHERE ($1::text[] = '{}' OR j.skill_ids && $1::text[])
       AND ($2::boolean IS NULL OR j.remote = $2)
       AND ($3::text IS NULL OR lower(j.title) LIKE $3 OR lower(COALESCE(j.company,'')) LIKE $3 OR lower(COALESCE(j.location,'')) LIKE $3)`,
    [skillIds, filters.remote ?? null, like],
  );

  return { jobs, total: count, matchedAgainst: skillIds.length };
}

export async function getJobStats() {
  const totals = await one<Record<string, unknown>>(
    `SELECT
       (SELECT count(*) FROM job_postings) AS "totalPostings",
       (SELECT count(*) FROM job_postings WHERE skill_ids <> '{}') AS "withSkills",
       (SELECT count(*) FROM job_postings WHERE remote) AS "remote",
       (SELECT max(captured_at) FROM job_postings) AS "lastCaptured"`,
  );
  const topSkills = await query<Record<string, unknown>>(
    `SELECT s.name, count(*)::int AS postings
     FROM job_postings j, unnest(j.skill_ids) sid JOIN skills s ON s.id = sid
     GROUP BY s.name ORDER BY postings DESC LIMIT 15`,
  );
  const bySource = await query<Record<string, unknown>>(
    `SELECT source_name AS "sourceName", count(*)::int AS postings, max(captured_at) AS "lastCaptured"
     FROM job_postings GROUP BY source_name ORDER BY postings DESC`,
  );
  const sample = await query<Record<string, unknown>>(
    `SELECT title, company, location, remote, url FROM job_postings ORDER BY captured_at DESC LIMIT 6`,
  );
  return { totals, topSkills, bySource, sample };
}
