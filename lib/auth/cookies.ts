import type { ResponseCookie } from "next/dist/compiled/@edge-runtime/cookies";

export const AUTH_COOKIES = {
  accessToken: "prepiq_access_token",
  refreshToken: "prepiq_refresh_token",
  /**
   * Set only during a support impersonation session. Holds banner metadata
   * (which admin, until when) — never a credential — so the root layout can
   * make it impossible to forget you are looking at someone else's account.
   */
  impersonation: "prepiq_impersonation",
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

type CookieWritableResponse = {
  cookies: {
    set: (name: string, value: string, options: CookieOptions) => void;
  };
};

export function clearAuthCookies(response: CookieWritableResponse): void {
  const expired = getExpiredCookieOptions();
  response.cookies.set(AUTH_COOKIES.accessToken, "", expired);
  response.cookies.set(AUTH_COOKIES.refreshToken, "", expired);
  // Must be cleared alongside the tokens: a stale banner claiming an
  // impersonation session that has already ended is worse than no banner.
  response.cookies.set(AUTH_COOKIES.impersonation, "", expired);
}

export interface ImpersonationContext {
  impersonator: string;
  email: string;
  fullName: string;
  /** Epoch milliseconds when the read-only token expires. */
  expiresAt: number;
}

export function serializeImpersonation(context: ImpersonationContext): string {
  return Buffer.from(JSON.stringify(context), "utf8").toString("base64url");
}

export function parseImpersonation(
  raw: string | undefined,
): ImpersonationContext | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(
      Buffer.from(raw, "base64url").toString("utf8"),
    ) as ImpersonationContext;
    if (!parsed?.impersonator || !parsed?.email) return null;
    // An expired context means the token is dead too; hide the banner rather
    // than claim a session that can no longer read anything.
    if (parsed.expiresAt && parsed.expiresAt < Date.now()) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function resolveBackendBaseUrl(): string {
  const baseUrl =
    process.env.API_BASE_URL ?? process.env.NEXT_PUBLIC_API_BASE_URL;

  if (!baseUrl) {
    throw new Error(
      "Set API_BASE_URL or NEXT_PUBLIC_API_BASE_URL to call backend auth endpoints.",
    );
  }

  return baseUrl.replace(/\/$/, "");
}

export function resolveBackendApiUrl(path: string): string {
  const baseUrl = resolveBackendBaseUrl();
  const root = baseUrl.endsWith("/api") ? baseUrl.slice(0, -4) : baseUrl;
  const normalizedPath = path
    .replace(/^\/+/, "")
    .replace(/^api\/+/, "")
    .replace(/\/$/, "");

  return `${root}/api/${normalizedPath}/`;
}
