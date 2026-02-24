import { NextResponse } from "next/server";
import { z } from "zod";
import {
  ACCESS_TOKEN_MAX_AGE_SECONDS,
  AUTH_COOKIES,
  REFRESH_TOKEN_MAX_AGE_SECONDS,
  getAccessTokenCookieOptions,
  getRefreshTokenCookieOptions,
  resolveBackendApiUrl,
} from "@/lib/auth/cookies";

const googleLoginRequestSchema = z.object({
  id_token: z.string().min(1),
});

const googleLoginResponseSchema = z.object({
  access: z.string(),
  refresh: z.string(),
  user_id: z.string(),
  email: z.string().email(),
  is_volunteer: z.boolean(),
  is_setup_complete: z.boolean(),
  has_organization: z.boolean(),
  missing_setup_fields: z.array(z.string()),
  created: z.boolean().optional(),
});

export async function POST(request: Request) {
  try {
    const body = googleLoginRequestSchema.parse(await request.json());

    const backendResponse = await fetch(resolveBackendApiUrl("auth/google/"), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      cache: "no-store",
    });

    const raw = await backendResponse.text();
    let payload: unknown = {};

    if (raw) {
      try {
        payload = JSON.parse(raw) as unknown;
      } catch {
        payload = { message: raw };
      }
    }

    if (!backendResponse.ok) {
      if (payload && typeof payload === "object") {
        return NextResponse.json(payload, { status: backendResponse.status });
      }
      return NextResponse.json(
        { message: "Google login failed" },
        { status: backendResponse.status },
      );
    }

    const parsed = googleLoginResponseSchema.parse(payload);

    const response = NextResponse.json(
      {
        user: {
          user_id: parsed.user_id,
          email: parsed.email,
          is_volunteer: parsed.is_volunteer,
          is_setup_complete: parsed.is_setup_complete,
          has_organization: parsed.has_organization,
          missing_setup_fields: parsed.missing_setup_fields,
          created: parsed.created ?? false,
        },
      },
      { status: 200 },
    );

    response.cookies.set(
      AUTH_COOKIES.accessToken,
      parsed.access,
      getAccessTokenCookieOptions(ACCESS_TOKEN_MAX_AGE_SECONDS),
    );

    response.cookies.set(
      AUTH_COOKIES.refreshToken,
      parsed.refresh,
      getRefreshTokenCookieOptions(REFRESH_TOKEN_MAX_AGE_SECONDS),
    );

    return response;
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { message: "Invalid Google login payload", issues: error.flatten() },
        { status: 400 },
      );
    }

    return NextResponse.json(
      { message: "Failed to login with Google" },
      { status: 500 },
    );
  }
}
