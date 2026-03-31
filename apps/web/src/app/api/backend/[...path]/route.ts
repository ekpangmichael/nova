import { NextRequest, NextResponse } from "next/server";

const AUTH_COOKIE_NAME = "nova_session";

const DEFAULT_BACKEND_BASES = [
  process.env.NOVA_BACKEND_URL,
  "http://127.0.0.1:4010/api",
  "http://127.0.0.1:4000/api",
].filter((value): value is string => Boolean(value));

const isRouteNotFoundPayload = (status: number, text: string) => {
  if (status !== 404) {
    return false;
  }

  try {
    const payload = JSON.parse(text) as {
      message?: string;
      error?: string | { message?: string };
    };

    const message =
      payload.message ??
      (typeof payload.error === "string" ? payload.error : payload.error?.message) ??
      "";

    return message.startsWith("Route ");
  } catch {
    return false;
  }
};

async function proxyRequest(
  request: NextRequest,
  pathSegments: string[]
) {
  const path = pathSegments.join("/");
  const search = request.nextUrl.search;
  const shouldReadBody =
    request.method === "POST" ||
    request.method === "PATCH" ||
    request.method === "PUT";
  const requestBody = shouldReadBody ? await request.arrayBuffer() : undefined;
  const body =
    requestBody && requestBody.byteLength > 0 ? requestBody : undefined;

  for (const baseUrl of DEFAULT_BACKEND_BASES) {
    const upstreamUrl = `${baseUrl}/${path}${search}`;
    const headers = new Headers();
    const accept = request.headers.get("accept");
    const contentType = request.headers.get("content-type");
    const sessionToken = request.cookies.get(AUTH_COOKIE_NAME)?.value;

    if (accept) {
      headers.set("accept", accept);
    }

    if (contentType) {
      headers.set("content-type", contentType);
    }

    if (sessionToken) {
      headers.set("x-nova-session-token", sessionToken);
    }

    try {
      const response = await fetch(upstreamUrl, {
        method: request.method,
        headers,
        body,
        cache: "no-store",
      });
      const responseBuffer = await response.arrayBuffer();
      const responseText = new TextDecoder().decode(responseBuffer);

      if (isRouteNotFoundPayload(response.status, responseText)) {
        continue;
      }

      const nextResponse =
        response.status === 204 ||
        response.status === 205 ||
        response.status === 304
          ? new NextResponse(null, {
              status: response.status,
            })
          : new NextResponse(responseBuffer, {
              status: response.status,
            });
      const responseContentType = response.headers.get("content-type");

      if (responseContentType) {
        nextResponse.headers.set("content-type", responseContentType);
      }

      return nextResponse;
    } catch {
      continue;
    }
  }

  return NextResponse.json(
    {
      error: {
        code: "backend_unavailable",
        message:
          "Backend is unavailable. Start the Fastify server and reload the page.",
      },
    },
    { status: 503 }
  );
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ path: string[] }> }
) {
  const { path } = await context.params;
  return proxyRequest(request, path);
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ path: string[] }> }
) {
  const { path } = await context.params;
  return proxyRequest(request, path);
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ path: string[] }> }
) {
  const { path } = await context.params;
  return proxyRequest(request, path);
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ path: string[] }> }
) {
  const { path } = await context.params;
  return proxyRequest(request, path);
}
