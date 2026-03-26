import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import {
  ACCESS_TOKEN_MAX_AGE_SECONDS,
  AUTH_COOKIES,
  clearAuthCookies,
  getAccessTokenCookieOptions,
  resolveBackendApiUrl,
} from "@/lib/auth/cookies";

type RouteContext = {
  params: Promise<{ path: string[] }>;
};

async function refreshAccessToken(refreshToken: string): Promise<string | null> {
  const response = await fetch(resolveBackendApiUrl("auth/refresh/"), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ refresh: refreshToken }),
    cache: "no-store",
  });

  if (!response.ok) {
    return null;
  }

  const payload = (await response.json()) as { access?: string };
  return payload.access ?? null;
}

/**
 * Resolve a two-letter language code from the incoming Accept-Language header.
 * Falls back to "en" for anything unsupported.
 */
function resolveLanguage(request: NextRequest): string {
  const supported = new Set(["en", "fr"]);
  const raw = request.headers.get("accept-language") ?? "";

  // Parse "fr-FR,fr;q=0.9,en;q=0.8" → ["fr", "en", ...]
  const preferred = raw
    .split(",")
    .map((part) => part.split(";")[0].trim().slice(0, 2).toLowerCase())
    .find((lang) => supported.has(lang));

  return preferred ?? "en";
}

async function proxyRequest(request: NextRequest, path: string[]) {
  const cookieStore = await cookies();
  const accessTokenFromCookie = cookieStore.get(AUTH_COOKIES.accessToken)?.value;
  const refreshToken = cookieStore.get(AUTH_COOKIES.refreshToken)?.value;

  const normalizedPath = path.join("/");
  const target = `${resolveBackendApiUrl(normalizedPath)}${request.nextUrl.search}`;
  const requestBody =
    request.method === "GET" || request.method === "HEAD"
      ? undefined
      : await request.arrayBuffer();

  const detectedLanguage = resolveLanguage(request);

  async function send(accessToken?: string) {
    const headers = new Headers(request.headers);
    headers.delete("host");
    headers.delete("connection");

    // Propagate detected language so the backend LocaleMiddleware picks it up.
    headers.set("X-Language", detectedLanguage);
    headers.set("Accept-Language", detectedLanguage);

    if (accessToken) {
      headers.set("Authorization", `Bearer ${accessToken}`);
    } else {
      headers.delete("Authorization");
    }

    return fetch(target, {
      method: request.method,
      headers,
      body: requestBody,
      cache: "no-store",
    });
  }

  let backendResponse: Response;
  try {
    backendResponse = await send(accessTokenFromCookie);
  } catch {
    return NextResponse.json(
      { message: "Upstream service unavailable" },
      { status: 502 },
    );
  }
  let refreshedToken: string | null = null;
  let refreshAttempted = false;
  let refreshRefused = false;

  if (backendResponse.status === 401 && refreshToken) {
    refreshAttempted = true;
    refreshedToken = await refreshAccessToken(refreshToken);
    if (refreshedToken) {
      try {
        backendResponse = await send(refreshedToken);
      } catch {
        return NextResponse.json(
          { message: "Upstream service unavailable" },
          { status: 502 },
        );
      }
    } else {
      refreshRefused = true;
    }
  }

  const responseHeaders = new Headers(backendResponse.headers);
  responseHeaders.delete("content-encoding");
  responseHeaders.delete("transfer-encoding");

  const response = new NextResponse(backendResponse.body, {
    status: backendResponse.status,
    headers: responseHeaders,
  });

  if (refreshedToken) {
    response.cookies.set(
      AUTH_COOKIES.accessToken,
      refreshedToken,
      getAccessTokenCookieOptions(ACCESS_TOKEN_MAX_AGE_SECONDS),
    );
  }

  if (
    backendResponse.status === 401 &&
    (refreshAttempted || Boolean(accessTokenFromCookie) || Boolean(refreshToken))
  ) {
    clearAuthCookies(response);
    response.headers.set("x-prepiq-auth-cleared", "1");
    if (refreshRefused) {
      response.headers.set("x-prepiq-auth-reason", "refresh_refused");
    }
  }

  return response;
}

export async function GET(request: NextRequest, context: RouteContext) {
  return proxyRequest(request, (await context.params).path);
}

export async function POST(request: NextRequest, context: RouteContext) {
  return proxyRequest(request, (await context.params).path);
}

export async function PUT(request: NextRequest, context: RouteContext) {
  return proxyRequest(request, (await context.params).path);
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  return proxyRequest(request, (await context.params).path);
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  return proxyRequest(request, (await context.params).path);
}
