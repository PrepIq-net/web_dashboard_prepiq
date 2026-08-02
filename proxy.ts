import { NextRequest, NextResponse } from "next/server";
import { AUTH_COOKIES } from "@/lib/auth/cookies";

/**
 * Routes that establish a session rather than requiring one.
 *
 * `/impersonate` redeems a single-use support code and writes the resulting
 * cookies itself. Gating it behind "already has a cookie" made the feature
 * usable only by an admin who happened to be signed into the dashboard already
 * — every other case bounced to /login with the code unspent. Its own
 * credential is the code, which the backend accepts once and only for a minute.
 */
const SESSION_ENTRY_PAGES = new Set(["/impersonate"]);

const AUTH_PAGES = new Set([
  "/login",
  "/register",
  "/forgot-password",
  "/forgot-password/verify",
  "/verify-otp",
  "/reset-password",
  "/verify",
  "/terms",
  "/privacy",
]);

function isPublicAsset(pathname: string): boolean {
  return (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon") ||
    pathname.startsWith("/logo") ||
    pathname.startsWith("/fonts") ||
    pathname.startsWith("/public") ||
    /\.(?:png|jpg|jpeg|gif|svg|webp|ico|css|js|map|txt)$/.test(pathname)
  );
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (
    pathname.startsWith("/api") ||
    isPublicAsset(pathname) ||
    SESSION_ENTRY_PAGES.has(pathname)
  ) {
    return NextResponse.next();
  }

  const accessToken = request.cookies.get(AUTH_COOKIES.accessToken)?.value;
  const refreshToken = request.cookies.get(AUTH_COOKIES.refreshToken)?.value;
  const isAuthenticated = Boolean(accessToken || refreshToken);

  if (AUTH_PAGES.has(pathname) && isAuthenticated) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  if (!AUTH_PAGES.has(pathname) && !isAuthenticated) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image).*)"],
};
