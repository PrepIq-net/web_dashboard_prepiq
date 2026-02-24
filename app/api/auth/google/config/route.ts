import { NextResponse } from "next/server";

export async function GET() {
  const clientId =
    process.env.GOOGLE_WEB_CLIENT_ID ?? process.env.NEXT_PUBLIC_GOOGLE_WEB_CLIENT_ID ?? "";

  if (!clientId) {
    return NextResponse.json(
      { message: "Google client id is not configured" },
      { status: 500 },
    );
  }

  return NextResponse.json({ clientId }, { status: 200 });
}
