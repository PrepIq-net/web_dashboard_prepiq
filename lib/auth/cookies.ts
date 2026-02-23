import type { ResponseCookie } from "next/dist/compiled/@edge-runtime/cookies";

export const AUTH_COOKIES = {
  accessToken: "prepiq_access_token",
  refreshToken: "prepiq_refresh_token",
} as const;

const isProduction = process.env.NODE_ENV === "production";

export const ACCESS_TOKEN_MAX_AGE_SECONDS = 15 * 60;
export const REFRESH_TOKEN_MAX_AGE_SECONDS = 30 * 24 * 60 * 60;

type CookieOptions = Partial<ResponseCookie>;

const baseCookieOptions: CookieOptions = {
  httpOnly: true,
  secure: isProduction,
  sameSite: "lax",
  path: "/",
};

export function getAccessTokenCookieOptions(
  maxAge = ACCESS_TOKEN_MAX_AGE_SECONDS,
): CookieOptions {
  return {
    ...baseCookieOptions,
    maxAge,
  };
}

export function getRefreshTokenCookieOptions(
  maxAge = REFRESH_TOKEN_MAX_AGE_SECONDS,
): CookieOptions {
  return {
    ...baseCookieOptions,
    maxAge,
  };
}

export function getExpiredCookieOptions(): CookieOptions {
  return {
    ...baseCookieOptions,
    maxAge: 0,
  };
}

export function resolveBackendBaseUrl(): string {
  const baseUrl = process.env.API_BASE_URL ?? process.env.NEXT_PUBLIC_API_BASE_URL;

  if (!baseUrl) {
    throw new Error("Set API_BASE_URL or NEXT_PUBLIC_API_BASE_URL to call backend auth endpoints.");
  }

  return baseUrl.replace(/\/$/, "");
}

export function resolveBackendApiUrl(path: string): string {
  const baseUrl = resolveBackendBaseUrl();
  const root = baseUrl.endsWith("/api") ? baseUrl.slice(0, -4) : baseUrl;
  const normalizedPath = path
    .replace(/^\/+/, "")
    .replace(/^api\/+/, "");

  return `${root}/api/${normalizedPath}`;
}
