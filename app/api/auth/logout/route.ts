import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import {
  AUTH_COOKIES,
  clearAuthCookies,
  resolveBackendApiUrl,
} from "@/lib/auth/cookies";

export async function POST() {
  const cookieStore = await cookies();
  const accessToken = cookieStore.get(AUTH_COOKIES.accessToken)?.value;
  const refreshToken = cookieStore.get(AUTH_COOKIES.refreshToken)?.value;

  if (refreshToken) {
    try {
      await fetch(resolveBackendApiUrl("auth/logout/"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        },
        body: JSON.stringify({ refresh_token: refreshToken }),
      });
    } catch {
      // Clear local cookies even when backend logout fails.
    }
  }

  const response = NextResponse.json({ message: "Logged out" }, { status: 200 });
  clearAuthCookies(response);

  return response;
}
