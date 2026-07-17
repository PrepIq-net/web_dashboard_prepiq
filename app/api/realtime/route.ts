import { NextResponse } from "next/server";
import { resolveBackendBaseUrl } from "@/lib/auth/cookies";

/**
 * Realtime bootstrap info for the Operations Hub.
 *
 * The browser cannot know the Django origin (all REST goes through the
 * cookie proxy), but a WebSocket must connect to the backend directly.
 * This route derives the ws:// endpoint (and the media origin for
 * attachment URLs) from the same server-side env the proxy uses.
 * The auth ticket itself is fetched separately through the proxy
 * (POST /chat/hub/ws-ticket/) so token refresh keeps working.
 */
export async function GET() {
  let base: string;
  try {
    base = resolveBackendBaseUrl();
  } catch {
    return NextResponse.json(
      { message: "Backend URL is not configured" },
      { status: 500 },
    );
  }

  const origin = base.endsWith("/api") ? base.slice(0, -4) : base;
  const wsOrigin = origin.replace(/^http/, "ws");

  return NextResponse.json({
    ws_url: `${wsOrigin}/ws/hub/`,
    media_origin: origin,
  });
}
