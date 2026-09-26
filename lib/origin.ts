import "server-only";

/**
 * `APP_ORIGIN` may hold ONE origin or a comma-separated list of them, e.g.
 *   APP_ORIGIN=https://aperio.sigmafusion.in,https://aperio-umber.vercel.app
 * The first entry is the "primary" origin — used wherever a single absolute URL
 * has to be baked in (emails, assistant links) and as the fallback when an
 * incoming request arrives on some host we don't recognise (a preview URL).
 * Any host in the list is treated as a first-class origin the app runs on.
 */
function stripTrailingSlash(value: string) {
  return value.replace(/\/+$/, "");
}

export function allowedOrigins(): string[] {
  const raw = process.env.APP_ORIGIN?.trim();
  if (!raw) return [];
  return [...new Set(raw.split(",").map((o) => stripTrailingSlash(o.trim())).filter(Boolean))];
}

export function primaryOrigin(fallback = ""): string {
  return allowedOrigins()[0] ?? stripTrailingSlash(fallback);
}

export function isAllowedOrigin(requestOrigin: string): boolean {
  return allowedOrigins().includes(stripTrailingSlash(requestOrigin));
}

/**
 * The origin the current request should run the rest of a flow on: the request's
 * own origin when it's one we recognise, otherwise the primary. Locally, with
 * `APP_ORIGIN` unset, this is just the request origin (http://localhost:3000).
 */
export function resolveOrigin(requestOrigin: string): string {
  const origin = stripTrailingSlash(requestOrigin);
  if (allowedOrigins().length === 0) return origin;
  return isAllowedOrigin(origin) ? origin : primaryOrigin(origin);
}
