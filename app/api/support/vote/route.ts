import { NextRequest, NextResponse } from "next/server";
import {
  getVerifiedProfile,
  landingSupportUrl,
  supportKeyHeaders,
} from "@/lib/support/server";

export const dynamic = "force-dynamic";

/** Toggle the caller's vote on a published feature request. */
export async function POST(request: NextRequest) {
  const profile = await getVerifiedProfile();
  if (!profile) {
    return NextResponse.json({ message: "Not authenticated" }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as { id?: string } | null;
  if (!body?.id) {
    return NextResponse.json({ message: "Missing feature request id" }, { status: 400 });
  }

  let upstream: Response;
  try {
    upstream = await fetch(
      landingSupportUrl(`feature-board/${encodeURIComponent(body.id)}/vote`),
      {
        method: "POST",
        headers: { ...supportKeyHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({
          voterEmail: profile.email,
          voterName: `${profile.first_name} ${profile.last_name}`.trim() || null,
        }),
        cache: "no-store",
      },
    );
  } catch (error) {
    console.error("[support] landing unreachable", error);
    return NextResponse.json({ message: "Voting unavailable" }, { status: 502 });
  }

  const payload = await upstream.json().catch(() => ({}));
  return NextResponse.json(payload, { status: upstream.status });
}
