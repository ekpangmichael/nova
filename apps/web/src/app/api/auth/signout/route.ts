import { NextResponse } from "next/server";
import { clearAuthCookie } from "../_shared";
import { getBackendAuthBaseUrl, getServerSessionToken } from "@/lib/auth";

export async function POST() {
  const sessionToken = await getServerSessionToken();

  if (sessionToken) {
    try {
      await fetch(`${getBackendAuthBaseUrl()}/auth/signout`, {
        method: "POST",
        cache: "no-store",
        headers: {
          "x-nova-session-token": sessionToken,
        },
      });
    } catch {
      // Clearing the local cookie still signs the user out of the web app.
    }
  }

  await clearAuthCookie();
  return new NextResponse(null, { status: 204 });
}
