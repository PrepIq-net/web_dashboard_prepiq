import { NextResponse } from "next/server";
import { z } from "zod";

import {
  AUTH_COOKIES,
  REFRESH_TOKEN_MAX_AGE_SECONDS,
  getAccessTokenCookieOptions,
  getRefreshTokenCookieOptions,
  resolveBackendApiUrl,
  serializeImpersonation,
} from "@/lib/auth/cookies";

/**
 * Landing point for a support impersonation link.
 *
 * The admin panel never receives a token — it gets a single-use exchange code
 * and sends the browser here. This handler redeems that code server-side and
 * writes the resulting read-only tokens straight into httpOnly cookies, so the
 * JWT never reaches client JavaScript, the URL bar, or a Referer header.
 *
 * The code itself is spent by the time this responds, which is what makes it
 * safe for it to have travelled as a query parameter.
 */

const exchangeResponseSchema = z.object({
  access: z.string(),
  refresh: z.string(),
  expires_in: z.number(),
  impersonator: z.string(),
  user: z.object({
    id: z.string(),
    email: z.string(),
    full_name: z.string(),
  }),
});

function failure(request: Request, reason: string) {
  const url = new URL("/login", request.url);
  url.searchParams.set("impersonation", reason);
  return NextResponse.redirect(url);
}

export async function GET(request: Request) {
  const code = new URL(request.url).searchParams.get("code");
  if (!code) return failure(request, "missing-code");

  let backendResponse: Response;
  try {
    backendResponse = await fetch(
      resolveBackendApiUrl("auth/impersonation/exchange/"),
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
        cache: "no-store",
      },
    );
  } catch {
    return failure(request, "backend-unreachable");
  }

  if (!backendResponse.ok) return failure(request, "expired");

  let parsed: z.infer<typeof exchangeResponseSchema>;
  try {
    parsed = exchangeResponseSchema.parse(await backendResponse.json());
  } catch {
    return failure(request, "invalid-response");
  }

  const response = NextResponse.redirect(new URL("/workspace", request.url));

  // Cookie lifetimes match the token's own TTL rather than the usual login
  // durations — when the read-only session dies, the cookies go with it
  // instead of leaving a signed-in shell that 401s on every request.
  response.cookies.set(
    AUTH_COOKIES.accessToken,
    parsed.access,
    getAccessTokenCookieOptions(parsed.expires_in),
  );
  response.cookies.set(
    AUTH_COOKIES.refreshToken,
    parsed.refresh,
    getRefreshTokenCookieOptions(
      Math.min(parsed.expires_in, REFRESH_TOKEN_MAX_AGE_SECONDS),
    ),
  );
  response.cookies.set(
    AUTH_COOKIES.impersonation,
    serializeImpersonation({
      impersonator: parsed.impersonator,
      email: parsed.user.email,
      fullName: parsed.user.full_name,
      expiresAt: Date.now() + parsed.expires_in * 1000,
    }),
    getAccessTokenCookieOptions(parsed.expires_in),
  );

  return response;
}
