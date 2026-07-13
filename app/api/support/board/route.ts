import { NextResponse } from "next/server";
import {
  getVerifiedProfile,
  landingSupportUrl,
  supportKeyHeaders,
} from "@/lib/support/server";

export const dynamic = "force-dynamic";

/** Published feature requests + whether the caller already voted for each. */
export async function GET() {
  const profile = await getVerifiedProfile();
  if (!profile) {
    return NextResponse.json({ message: "Not authenticated" }, { status: 401 });
  }

  let upstream: Response;
  try {
    upstream = await fetch(
      `${landingSupportUrl("feature-board")}?voter=${encodeURIComponent(profile.email)}`,
      { headers: supportKeyHeaders(), cache: "no-store" },
    );
  } catch (error) {
    console.error("[support] landing unreachable", error);
    return NextResponse.json(
      { message: "Feature board unavailable" },
      { status: 502 },
    );
  }

  const payload = await upstream.json().catch(() => ({}));
  return NextResponse.json(payload, { status: upstream.status });
}
