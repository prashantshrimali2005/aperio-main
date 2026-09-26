import { NextResponse } from "next/server";
import {
  OAUTH_STATE_COOKIE,
  buildGoogleAuthUrl,
  canonicalOrigin,
  googleRedirectUri,
  isGoogleOAuthConfigured,
  issueOAuthState,
} from "@/lib/google";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const canonical = canonicalOrigin(url.origin);

  if (!isGoogleOAuthConfigured()) {
    return NextResponse.redirect(new URL("/login?error=google_unavailable", canonical));
  }

  // Each origin in APP_ORIGIN runs its own flow (its callback URL must be
  // registered with Google). Anything else — a preview URL, a bare deployment
  // URL — is bounced to the primary origin first so the redirect_uri we hand
  // Google is always one it recognises. (Locally, with APP_ORIGIN unset,
  // canonical === url.origin, so this never fires.)
  if (canonical !== url.origin && url.searchParams.get("canonical") !== "1") {
    const bounce = new URL("/api/v1/auth/google", canonical);
    bounce.searchParams.set("canonical", "1");
    return NextResponse.redirect(bounce);
  }

  // `state` is signed and self-validating (see lib/google.ts). The cookie is a
  // best-effort second factor — the flow no longer breaks if it doesn't survive
  // the round trip to Google.
  const { state, nonce } = issueOAuthState();
  const response = NextResponse.redirect(
    buildGoogleAuthUrl({ state, redirectUri: googleRedirectUri(canonical) }),
  );
  response.cookies.set(OAUTH_STATE_COOKIE, nonce, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 600,
  });
  response.headers.set("cache-control", "no-store");
  return response;
}
