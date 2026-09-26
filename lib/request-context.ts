import "server-only";

import { createHash } from "node:crypto";
import { headers } from "next/headers";

/** Everything we can learn about who/where a request came from. */
export interface ClientContext {
  ip: string | null;
  userAgent: string | null;
  browser: string;
  os: string;
  deviceType: "desktop" | "mobile" | "tablet" | "bot" | "unknown";
  city: string | null;
  region: string | null;
  country: string | null;
  /** ISP / hosting org, e.g. "Google LLC" or "Jio". Needs IPINFO_TOKEN. */
  isp: string | null;
  timezone: string | null;
  /** Coarse device hash: same laptop+browser stays stable across IP changes. */
  fingerprint: string;
  /** Human sentence for emails, e.g. "Chrome on macOS · desktop". */
  deviceLabel: string;
  /** Human sentence for emails, e.g. "Mumbai, Maharashtra, IN". */
  locationLabel: string;
  when: string;
}

const PRIVATE_IP =
  /^(10\.|127\.|0\.|169\.254\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|::1$|fc|fd|fe80:)/i;

function firstIp(value: string | null | undefined): string | null {
  if (!value) return null;
  const ip = value.split(",")[0]?.trim();
  return ip || null;
}

function parseUserAgent(ua: string | null) {
  if (!ua) return { browser: "Unknown browser", os: "Unknown OS", deviceType: "unknown" as const };

  let os = "Unknown OS";
  if (/windows nt 10/i.test(ua)) os = "Windows 10/11";
  else if (/windows nt/i.test(ua)) os = "Windows";
  else if (/iphone|ipad|ipod/i.test(ua)) os = /ipad/i.test(ua) ? "iPadOS" : "iOS";
  else if (/mac os x ([\d_]+)/i.test(ua)) os = "macOS";
  else if (/android ([\d.]+)/i.test(ua)) os = `Android ${RegExp.$1}`;
  else if (/android/i.test(ua)) os = "Android";
  else if (/cros/i.test(ua)) os = "ChromeOS";
  else if (/linux/i.test(ua)) os = "Linux";

  let browser = "Unknown browser";
  const ver = (re: RegExp) => (re.exec(ua)?.[1] ?? "").split(".")[0];
  if (/edg\//i.test(ua)) browser = `Edge ${ver(/edg\/([\d.]+)/i)}`.trim();
  else if (/opr\/|opera/i.test(ua)) browser = `Opera ${ver(/(?:opr|opera)\/([\d.]+)/i)}`.trim();
  else if (/firefox\//i.test(ua)) browser = `Firefox ${ver(/firefox\/([\d.]+)/i)}`.trim();
  else if (/edga|edgios/i.test(ua)) browser = "Edge";
  else if (/crios\//i.test(ua)) browser = `Chrome ${ver(/crios\/([\d.]+)/i)}`.trim();
  else if (/chrome\//i.test(ua)) browser = `Chrome ${ver(/chrome\/([\d.]+)/i)}`.trim();
  else if (/safari\//i.test(ua) && /version\//i.test(ua)) browser = `Safari ${ver(/version\/([\d.]+)/i)}`.trim();
  else if (/bot|crawl|spider|slurp|curl|wget|python-requests|node-fetch/i.test(ua)) browser = "Automated client";

  let deviceType: ClientContext["deviceType"] = "desktop";
  if (/bot|crawl|spider|slurp|headless/i.test(ua)) deviceType = "bot";
  else if (/tablet|ipad|playbook|silk|(android(?!.*mobile))/i.test(ua)) deviceType = "tablet";
  else if (/mobi|iphone|ipod|android.*mobile|windows phone/i.test(ua)) deviceType = "mobile";

  return { browser: browser.trim() || "Unknown browser", os, deviceType };
}

/** ipinfo.io lookup for ISP/org + geo. No-ops without IPINFO_TOKEN or on private IPs. */
async function ipinfoLookup(ip: string | null) {
  const token = process.env.IPINFO_TOKEN?.trim();
  if (!token || !ip || PRIVATE_IP.test(ip)) return null;
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 2500);
    const res = await fetch(`https://ipinfo.io/${encodeURIComponent(ip)}/json?token=${token}`, {
      signal: controller.signal,
      headers: { accept: "application/json" },
    });
    clearTimeout(timer);
    if (!res.ok) return null;
    const data = (await res.json()) as {
      city?: string; region?: string; country?: string; org?: string; timezone?: string;
    };
    return {
      city: data.city || null,
      region: data.region || null,
      country: data.country || null,
      // "AS15169 Google LLC" -> "Google LLC"
      isp: data.org ? data.org.replace(/^AS\d+\s+/i, "").trim() : null,
      timezone: data.timezone || null,
    };
  } catch {
    return null;
  }
}

/**
 * Build a full client context for the current request. Pass the route's
 * `Request` when you have it; otherwise it reads the ambient `headers()`.
 */
export async function describeClient(request?: Request): Promise<ClientContext> {
  let h: Headers;
  try {
    h = request ? request.headers : await headers();
  } catch {
    h = new Headers();
  }

  const ip =
    firstIp(h.get("x-forwarded-for")) ||
    h.get("x-real-ip") ||
    h.get("cf-connecting-ip") ||
    null;
  const userAgent = h.get("user-agent")?.slice(0, 400) || null;
  const { browser, os, deviceType } = parseUserAgent(userAgent);

  // Vercel edge geo headers (present in production) — city is URL-encoded.
  const dec = (v: string | null) => {
    if (!v) return null;
    try { return decodeURIComponent(v); } catch { return v; }
  };
  let city = dec(h.get("x-vercel-ip-city"));
  let region = dec(h.get("x-vercel-ip-country-region"));
  let country = h.get("x-vercel-ip-country") || null;
  let timezone = h.get("x-vercel-ip-timezone") || null;
  let isp: string | null = null;

  const info = await ipinfoLookup(ip);
  if (info) {
    city = city || info.city;
    region = region || info.region;
    country = country || info.country;
    timezone = timezone || info.timezone;
    isp = info.isp;
  }

  const fingerprint = createHash("sha256")
    .update(`${os}|${browser.replace(/\s+\d.*$/, "")}|${deviceType}`)
    .digest("hex")
    .slice(0, 32);

  const deviceLabel = `${browser} on ${os} · ${deviceType}`;
  const locationLabel =
    [city, region, country].filter(Boolean).join(", ") || (ip ? "Unknown location" : "Unknown");

  return {
    ip,
    userAgent,
    browser,
    os,
    deviceType,
    city,
    region,
    country,
    isp,
    timezone,
    fingerprint,
    deviceLabel,
    locationLabel,
    when: new Date().toUTCString(),
  };
}
