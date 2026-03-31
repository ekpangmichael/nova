import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { AUTH_COOKIE_NAME, buildSessionCookieConfig, getBackendAuthBaseUrl } from "@/lib/auth";

type BackendAuthResponse = {
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

export const parseJsonBody = async (request: Request) => {
  try {
    return await request.json();
  } catch {
    return null;
  }
};

export const relayBackendAuthRequest = async (
  path: "signin" | "signup",
  payload: unknown
) => {
  const response = await fetch(`${getBackendAuthBaseUrl()}/auth/${path}`, {
    method: "POST",
    cache: "no-store",
    headers: {
      Accept: "application/json",
      "content-type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorText = await response.text();

    return new NextResponse(errorText, {
      status: response.status,
      headers: {
        "content-type": response.headers.get("content-type") ?? "application/json",
      },
    });
  }

  const data = (await response.json()) as BackendAuthResponse;
  const cookieStore = await cookies();
  cookieStore.set({
    ...buildSessionCookieConfig(data.expiresAt),
    name: AUTH_COOKIE_NAME,
    value: data.sessionToken,
  });

  return NextResponse.json({
    user: data.user,
    expiresAt: data.expiresAt,
  });
};

export const clearAuthCookie = async () => {
  const cookieStore = await cookies();
  cookieStore.delete(AUTH_COOKIE_NAME);
};
