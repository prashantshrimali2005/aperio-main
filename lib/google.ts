import "server-only";

import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { resolveOrigin } from "@/lib/origin";

const AUTH_ENDPOINT = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";
const USERINFO_ENDPOINT = "https://openidconnect.googleapis.com/v1/userinfo";

export const OAUTH_STATE_COOKIE = "aperio_oauth_state";

function clientId() {
  return process.env.GOOGLE_CLIENT_ID?.trim() || "";
}

function clientSecret() {
  return process.env.GOOGLE_CLIENT_SECRET?.trim() || "";
}

export function isGoogleOAuthConfigured() {
  return Boolean(clientId() && clientSecret());
}

/**
 * The origin the OAuth round-trip runs on for this request. `APP_ORIGIN` may be
 * a comma-separated allowlist (e.g. the vercel.app host and a custom domain);
 * any host in it runs its own flow, and anything else (a preview URL) is sent to
 * the primary. Locally, with `APP_ORIGIN` unset, this is the request origin.
 */
export function canonicalOrigin(requestOrigin: string) {
  return resolveOrigin(requestOrigin);
}

/**
 * The redirect URI must exactly match one registered in the Google Cloud
 * console — register EVERY origin listed in `APP_ORIGIN`.
 */
export function googleRedirectUri(requestOrigin: string) {
  return `${resolveOrigin(requestOrigin)}/api/v1/auth/google/callback`;
}

// --- CSRF state ------------------------------------------------------------
//
// `state` is a self-contained, HMAC-signed token: `<nonce>.<issuedAt>.<mac>`.
// Google echoes it back verbatim on the callback, so the round trip can be
// validated from the signature alone. This is deliberately NOT dependent on the
// state cookie surviving the redirect to Google and back — that SameSite=Lax
// cookie was going missing on the callback and producing a permanent
// `google_state` on every attempt. The nonce is still dropped in a cookie and,
// when that cookie does survive, checked as a second factor.

const STATE_TTL_MS = 10 * 60 * 1000;

function stateSecret() {
  const raw = process.env.APP_ENCRYPTION_KEY?.trim() || clientSecret();
  if (!raw) throw new Error("OAuth state signing needs APP_ENCRYPTION_KEY or GOOGLE_CLIENT_SECRET");
  return raw;
}

function signStatePayload(payload: string) {
  return createHmac("sha256", stateSecret()).update(payload).digest("base64url");
}

export function issueOAuthState() {
  const nonce = randomBytes(16).toString("base64url");
  const payload = `${nonce}.${Date.now()}`;
  return { state: `${payload}.${signStatePayload(payload)}`, nonce };
}

export function verifyOAuthState(state: string | null | undefined, cookieNonce: string | undefined) {
  if (!state) return false;
  const parts = state.split(".");
  if (parts.length !== 3) return false;
  const [nonce, issuedAt, mac] = parts;

  const expected = Buffer.from(signStatePayload(`${nonce}.${issuedAt}`));
  const received = Buffer.from(mac);
  if (expected.length !== received.length || !timingSafeEqual(expected, received)) return false;

  const ts = Number(issuedAt);
  if (!Number.isFinite(ts) || Date.now() - ts > STATE_TTL_MS || ts - Date.now() > 60_000) return false;

  // When the state cookie made it back, it must match the signed nonce.
  if (cookieNonce && cookieNonce !== nonce) return false;
  return true;
}

export function buildGoogleAuthUrl(input: { state: string; redirectUri: string }) {
  const url = new URL(AUTH_ENDPOINT);
  url.searchParams.set("client_id", clientId());
  url.searchParams.set("redirect_uri", input.redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", "openid email profile");
  url.searchParams.set("state", input.state);
  url.searchParams.set("prompt", "select_account");
  return url.toString();
}

const tokenSchema = z.object({
  access_token: z.string().min(1),
  id_token: z.string().optional(),
  expires_in: z.number().optional(),
});

const profileSchema = z.object({
  sub: z.string().min(1),
  email: z.string().email(),
  email_verified: z.union([z.boolean(), z.string()]).optional(),
  name: z.string().optional(),
  picture: z.string().url().optional(),
});

export type GoogleProfile = z.infer<typeof profileSchema>;

export async function exchangeGoogleCode(code: string, redirectUri: string) {
  const response = await fetch(TOKEN_ENDPOINT, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: clientId(),
      client_secret: clientSecret(),
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }),
  });
  if (!response.ok) {
    console.error("Google token exchange failed", response.status, await response.text().catch(() => ""));
    throw new Error("GOOGLE_TOKEN_EXCHANGE_FAILED");
  }
  return tokenSchema.parse(await response.json());
}

export async function fetchGoogleProfile(accessToken: string): Promise<GoogleProfile> {
  const response = await fetch(USERINFO_ENDPOINT, {
    headers: { authorization: `Bearer ${accessToken}` },
  });
  if (!response.ok) {
    console.error("Google userinfo request failed", response.status);
    throw new Error("GOOGLE_USERINFO_FAILED");
  }
  return profileSchema.parse(await response.json());
}

export function isGoogleEmailVerified(profile: GoogleProfile) {
  return profile.email_verified === true || profile.email_verified === "true";
}
