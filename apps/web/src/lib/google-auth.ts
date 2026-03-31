import "server-only";

import { randomBytes } from "node:crypto";

export const GOOGLE_AUTH_STATE_COOKIE_NAME = "nova_google_oauth_state";

const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_USERINFO_URL = "https://openidconnect.googleapis.com/v1/userinfo";

export type GoogleOAuthUser = {
  sub: string;
  email: string;
  email_verified: boolean;
  name?: string;
  picture?: string;
};

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID ?? null;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET ?? null;

export const isGoogleAuthConfigured = () =>
  Boolean(GOOGLE_CLIENT_ID && GOOGLE_CLIENT_SECRET);

export const getGoogleOAuthConfig = () => {
  if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
    throw new Error(
      "Google auth is not configured. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET."
    );
  }

  return {
    clientId: GOOGLE_CLIENT_ID,
    clientSecret: GOOGLE_CLIENT_SECRET,
  };
};

export const createGoogleOAuthState = () => randomBytes(24).toString("hex");

export const buildGoogleCallbackUrl = (origin: string) =>
  new URL("/api/auth/google/callback", origin).toString();

export const buildGoogleAuthorizationUrl = (input: {
  origin: string;
  state: string;
}) => {
  const { clientId } = getGoogleOAuthConfig();
  const url = new URL(GOOGLE_AUTH_URL);

  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", buildGoogleCallbackUrl(input.origin));
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", "openid email profile");
  url.searchParams.set("state", input.state);
  url.searchParams.set("prompt", "select_account");

  return url;
};

export const exchangeGoogleCodeForTokens = async (input: {
  code: string;
  origin: string;
}) => {
  const { clientId, clientSecret } = getGoogleOAuthConfig();
  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      code: input.code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: buildGoogleCallbackUrl(input.origin),
      grant_type: "authorization_code",
    }),
  });

  if (!response.ok) {
    throw new Error("Google token exchange failed.");
  }

  return (await response.json()) as {
    access_token: string;
    id_token?: string;
    expires_in?: number;
    scope?: string;
    token_type?: string;
  };
};

export const fetchGoogleUser = async (accessToken: string) => {
  const response = await fetch(GOOGLE_USERINFO_URL, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/json",
    },
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error("Google user profile fetch failed.");
  }

  return (await response.json()) as GoogleOAuthUser;
};
