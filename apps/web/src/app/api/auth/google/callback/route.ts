import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { AUTH_COOKIE_NAME, buildAuthErrorRedirectUrl, buildSessionCookieConfig, getBackendAuthBaseUrl } from "@/lib/auth";
import {
  GOOGLE_AUTH_STATE_COOKIE_NAME,
  exchangeGoogleCodeForTokens,
  fetchGoogleUser,
  isGoogleAuthConfigured,
} from "@/lib/google-auth";

type BackendGoogleAuthResponse = {
  user: {
    id: string;
    email: string;
    displayName: string;
    lastSignedInAt: string | null;
    createdAt: string;
    updatedAt: string;
  };
  expiresAt: string;
  sessionToken: string;
};

const clearGoogleStateCookie = async () => {
  const cookieStore = await cookies();
  cookieStore.delete(GOOGLE_AUTH_STATE_COOKIE_NAME);
};

export async function GET(request: NextRequest) {
  if (!isGoogleAuthConfigured()) {
    return NextResponse.redirect(
      buildAuthErrorRedirectUrl(request.nextUrl.origin, "google_not_configured")
    );
  }

  const code = request.nextUrl.searchParams.get("code");
  const state = request.nextUrl.searchParams.get("state");
  const oauthError = request.nextUrl.searchParams.get("error");

  if (oauthError) {
    await clearGoogleStateCookie();
    return NextResponse.redirect(
      buildAuthErrorRedirectUrl(request.nextUrl.origin, "google_cancelled")
    );
  }

  const cookieStore = await cookies();
  const expectedState = cookieStore.get(GOOGLE_AUTH_STATE_COOKIE_NAME)?.value ?? null;

  if (!code || !state || !expectedState || state !== expectedState) {
    await clearGoogleStateCookie();
    return NextResponse.redirect(
      buildAuthErrorRedirectUrl(request.nextUrl.origin, "google_state_invalid")
    );
  }

  try {
    const tokens = await exchangeGoogleCodeForTokens({
      code,
      origin: request.nextUrl.origin,
    });
    const googleUser = await fetchGoogleUser(tokens.access_token);
    const backendResponse = await fetch(`${getBackendAuthBaseUrl()}/auth/google`, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        email: googleUser.email,
        displayName: googleUser.name ?? googleUser.email,
        googleSub: googleUser.sub,
        emailVerified: googleUser.email_verified,
      }),
      cache: "no-store",
    });

    if (!backendResponse.ok) {
      throw new Error("Nova could not create a session from the Google profile.");
    }

    const session = (await backendResponse.json()) as BackendGoogleAuthResponse;
    await clearGoogleStateCookie();
    cookieStore.set({
      ...buildSessionCookieConfig(session.expiresAt),
      name: AUTH_COOKIE_NAME,
      value: session.sessionToken,
    });

    return NextResponse.redirect(new URL("/", request.nextUrl.origin));
  } catch {
    await clearGoogleStateCookie();
    return NextResponse.redirect(
      buildAuthErrorRedirectUrl(request.nextUrl.origin, "google_callback_failed")
    );
  }
}
