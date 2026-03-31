import { NextResponse } from "next/server";
import { parseJsonBody, relayBackendAuthRequest } from "../_shared";

export async function POST(request: Request) {
  const payload = await parseJsonBody(request);

  if (!payload) {
    return NextResponse.json(
      {
        error: {
          code: "bad_request",
          message: "Invalid request payload.",
        },
      },
      { status: 400 }
    );
  }

  return relayBackendAuthRequest("signin", payload);
}
