import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { AUTH_ERROR_QUERY_KEY, buildAuthErrorRedirectUrl } from "@/lib/auth";
import {
  GOOGLE_AUTH_STATE_COOKIE_NAME,
  buildGoogleAuthorizationUrl,
  createGoogleOAuthState,
  isGoogleAuthConfigured,
} from "@/lib/google-auth";

export async function GET(request: NextRequest) {
  if (!isGoogleAuthConfigured()) {
    return NextResponse.redirect(
      buildAuthErrorRedirectUrl(request.nextUrl.origin, "google_not_configured")
    );
  }

  const state = createGoogleOAuthState();
  const cookieStore = await cookies();
  cookieStore.set({
    name: GOOGLE_AUTH_STATE_COOKIE_NAME,
    value: state,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 10,
  });

  return NextResponse.redirect(
    buildGoogleAuthorizationUrl({
      origin: request.nextUrl.origin,
      state,
    })
  );
}
