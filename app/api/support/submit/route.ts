import { NextRequest, NextResponse } from "next/server";
import {
  getVerifiedProfile,
  landingSupportUrl,
  supportKeyHeaders,
} from "@/lib/support/server";

export const dynamic = "force-dynamic";

const CLIENT_FIELDS = [
  "type",
  "subject",
  "message",
  "contactEmail",
  "branchId",
  "branchName",
  "currentUrl",
  "locale",
] as const;

/**
 * Receives the support form from the browser, stamps it with the caller's
 * server-verified identity, and forwards it (attachments included) to the
 * landing app's support inbox.
 */
export async function POST(request: NextRequest) {
  const profile = await getVerifiedProfile();
  if (!profile) {
    return NextResponse.json({ message: "Not authenticated" }, { status: 401 });
  }

  let incoming: FormData;
  try {
    incoming = await request.formData();
  } catch {
    return NextResponse.json({ message: "Expected form data" }, { status: 400 });
  }

  const outgoing = new FormData();
  for (const field of CLIENT_FIELDS) {
    const value = incoming.get(field);
    if (typeof value === "string" && value.trim() !== "") {
      outgoing.set(field, value);
    }
  }

  // Verified identity — always attached regardless of what the client sent.
  outgoing.set("reporterEmail", profile.email);
  outgoing.set(
    "reporterName",
    `${profile.first_name} ${profile.last_name}`.trim()
  );
  outgoing.set("reporterUserId", String(profile.id));
  if (profile.organization_role) outgoing.set("reporterRole", profile.organization_role);
  if (profile.organization_id) outgoing.set("organizationId", profile.organization_id);
  if (profile.organization_name) outgoing.set("organizationName", profile.organization_name);
  outgoing.set("sourceApp", "web_dashboard");
  outgoing.set("userAgent", request.headers.get("user-agent") ?? "");
  if (!outgoing.get("locale") && profile.preferred_language) {
    outgoing.set("locale", profile.preferred_language);
  }

  for (const entry of incoming.getAll("attachments")) {
    if (entry instanceof File && entry.size > 0) {
      outgoing.append("attachments", entry, entry.name);
    }
  }

  let upstream: Response;
  try {
    upstream = await fetch(landingSupportUrl("requests"), {
      method: "POST",
      headers: supportKeyHeaders(),
      body: outgoing,
      cache: "no-store",
    });
  } catch (error) {
    console.error("[support] landing unreachable", error);
    return NextResponse.json(
      { message: "Support service unavailable. Please try again." },
      { status: 502 },
    );
  }

  const payload = await upstream.json().catch(() => ({}));
  return NextResponse.json(payload, { status: upstream.status });
}
