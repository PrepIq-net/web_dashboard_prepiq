import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { AUTH_COOKIES } from "@/lib/auth/cookies";

export async function GET() {
  const cookieStore = await cookies();
  const hasAccessToken = Boolean(cookieStore.get(AUTH_COOKIES.accessToken)?.value);
  const hasRefreshToken = Boolean(cookieStore.get(AUTH_COOKIES.refreshToken)?.value);

  return NextResponse.json(
    {
      authenticated: hasAccessToken || hasRefreshToken,
      hasAccessToken,
      hasRefreshToken,
    },
    { status: 200 },
  );
}
