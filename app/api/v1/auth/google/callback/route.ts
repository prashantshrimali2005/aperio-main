import { randomUUID } from "node:crypto";
import { cookies } from "next/headers";
import { NextResponse, after } from "next/server";
import { createSession } from "@/lib/auth";
import { syncAdminRole } from "@/lib/admin";
import { logActivity, touchLastSeen } from "@/lib/activity";
import { sendWelcomeEmail } from "@/lib/email";
import { notifyAccountChange, recordLoginAndNotify } from "@/lib/security-emails";
import { db, one, query } from "@/lib/db";
import {
  OAUTH_STATE_COOKIE,
  canonicalOrigin,
  exchangeGoogleCode,
  fetchGoogleProfile,
  googleRedirectUri,
  isGoogleEmailVerified,
  isGoogleOAuthConfigured,
  verifyOAuthState,
} from "@/lib/google";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function GET(request: Request) {
  const url = new URL(request.url);
  const base = canonicalOrigin(url.origin);
  // Clear the one-time state cookie on every response we return from here.
  const back = (path: string) => {
    const response = NextResponse.redirect(new URL(path, base));
    response.cookies.set(OAUTH_STATE_COOKIE, "", { httpOnly: true, path: "/", maxAge: 0 });
    response.headers.set("cache-control", "no-store");
    return response;
  };

  const cookieStore = await cookies();
  const stateCookie = cookieStore.get(OAUTH_STATE_COOKIE)?.value;

  if (!isGoogleOAuthConfigured()) return back("/login?error=google_unavailable");

  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  if (url.searchParams.get("error")) return back("/login?error=google_denied");
  // `state` is HMAC-signed, so a valid signature + fresh timestamp is enough on
  // its own; the cookie is only enforced when it actually came back.
  if (!code || !verifyOAuthState(state, stateCookie)) return back("/login?error=google_state");

  const redirectUri = googleRedirectUri(url.origin);

  let accessToken: string;
  try {
    accessToken = (await exchangeGoogleCode(code, redirectUri)).access_token;
  } catch (error) {
    console.error("Google OAuth: token exchange failed", { redirectUri, message: error instanceof Error ? error.message : error });
    return back("/login?error=google_token");
  }

  let profile;
  try {
    profile = await fetchGoogleProfile(accessToken);
  } catch (error) {
    console.error("Google OAuth: userinfo failed", error instanceof Error ? error.message : error);
    return back("/login?error=google_profile");
  }
  if (!isGoogleEmailVerified(profile)) return back("/login?error=google_unverified");

  const email = profile.email.toLowerCase();
  const fullName = (profile.name?.trim() || email.split("@")[0]).slice(0, 80);
  const picture = profile.picture ?? null;

  let userId: string;
  let isNewUser = false;
  let linkedGoogle = false;
  try {
    const byGoogleId = await one<{ id: string }>("SELECT id FROM users WHERE google_id=$1", [profile.sub]);
    if (byGoogleId) {
      userId = byGoogleId.id;
      await query("UPDATE users SET avatar_url=COALESCE($1,avatar_url), updated_at=now() WHERE id=$2", [picture, userId]);
    } else {
      const byEmail = await one<{ id: string }>("SELECT id FROM users WHERE email=$1", [email]);
      if (byEmail) {
        userId = byEmail.id;
        linkedGoogle = true;
        await query(
          "UPDATE users SET google_id=$1, avatar_url=COALESCE($2,avatar_url), updated_at=now() WHERE id=$3",
          [profile.sub, picture, userId],
        );
      } else {
        userId = randomUUID();
        isNewUser = true;
        const sql = db();
        await sql.transaction((tx) => [
          tx`INSERT INTO users (id,email,full_name,google_id,avatar_url,auth_provider)
             VALUES (${userId},${email},${fullName},${profile.sub},${picture},'google')`,
          tx`INSERT INTO profiles (user_id) VALUES (${userId})`,
          tx`INSERT INTO preferences (user_id) VALUES (${userId})`,
        ]);
      }
    }
  } catch (error) {
    console.error("Google OAuth: account store failed (has migration 003 been applied?)", error instanceof Error ? error.message : error);
    return back("/login?error=google_store");
  }

  try {
    await createSession(userId);
  } catch (error) {
    console.error("Google OAuth: session creation failed", error instanceof Error ? error.message : error);
    return back("/login?error=google_session");
  }

  await syncAdminRole(userId, email);
  await touchLastSeen(userId);
  await logActivity({
    action: isNewUser ? "auth.register" : "auth.login.google",
    userId,
    actorEmail: email,
    metadata: { provider: "google" },
    request,
  });
  if (isNewUser) void sendWelcomeEmail({ email, fullName });

  const uid = userId;
  after(async () => {
    await recordLoginAndNotify({
      userId: uid,
      email,
      fullName,
      method: "Google",
      request,
      suppressNewDeviceAlert: isNewUser,
    });
    if (linkedGoogle) {
      await notifyAccountChange({
        userId: uid,
        summary: "Google sign-in was linked",
        detail: `Your Aperio account (${email}) can now be accessed with “Sign in with Google”.`,
        request,
      });
    }
  });

  return back(isNewUser ? "/onboarding" : "/overview");
}
