import "server-only";

import { cookies } from "next/headers";

export const AUTH_COOKIE_NAME = "nova_session";
export const AUTH_ERROR_QUERY_KEY = "error";

const BACKEND_AUTH_BASE_URL =
  process.env.NOVA_BACKEND_URL?.replace(/\/$/, "") ?? "http://127.0.0.1:4010/api";

export type AuthenticatedUser = {
  id: string;
  email: string;
  displayName: string;
  lastSignedInAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ServerAuthSession = {
  user: AuthenticatedUser;
  expiresAt: string;
};

type BackendAuthSuccess = ServerAuthSession & {
  sessionToken?: string;
};

export const buildSessionCookieConfig = (expiresAt: string) => ({
  name: AUTH_COOKIE_NAME,
  value: "",
  httpOnly: true as const,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
  expires: new Date(expiresAt),
});

export const buildAuthErrorRedirectUrl = (origin: string, code: string) => {
  const url = new URL("/signin", origin);
  url.searchParams.set(AUTH_ERROR_QUERY_KEY, code);
  return url;
};

export const getBackendAuthBaseUrl = () => BACKEND_AUTH_BASE_URL;

export const getServerSessionToken = async () => {
  const cookieStore = await cookies();
  return cookieStore.get(AUTH_COOKIE_NAME)?.value ?? null;
};

export const getServerAuthSession = async (): Promise<ServerAuthSession | null> => {
  const sessionToken = await getServerSessionToken();

  if (!sessionToken) {
    return null;
  }

  try {
    const response = await fetch(`${BACKEND_AUTH_BASE_URL}/auth/session`, {
      method: "GET",
      cache: "no-store",
      headers: {
        Accept: "application/json",
        "x-nova-session-token": sessionToken,
      },
    });

    if (!response.ok) {
      return null;
    }

    return (await response.json()) as BackendAuthSuccess;
  } catch {
    return null;
  }
};
