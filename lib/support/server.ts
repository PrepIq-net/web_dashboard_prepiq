import { cookies } from "next/headers";
import { AUTH_COOKIES, resolveBackendApiUrl } from "@/lib/auth/cookies";
import { LANDING_BASE_URL } from "@/lib/legal";

/**
 * Server-side plumbing for the support pipeline: requests are verified against
 * the Django backend using the caller's HttpOnly session cookies, then
 * forwarded to the landing app's support API with the shared server-to-server
 * key. The key never reaches the browser.
 */

export type VerifiedProfile = {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  job_title: string | null;
  organization_id: string | null;
  organization_name: string | null;
  organization_role: string | null;
  preferred_language?: string;
};

async function fetchProfile(accessToken: string): Promise<Response> {
  return fetch(resolveBackendApiUrl("user/me/"), {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  });
}

async function refreshAccessToken(refreshToken: string): Promise<string | null> {
  const response = await fetch(resolveBackendApiUrl("auth/refresh/"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refresh: refreshToken }),
    cache: "no-store",
  });
  if (!response.ok) return null;
  const payload = (await response.json()) as { access?: string };
  return payload.access ?? null;
}

/**
 * Resolve the caller's verified identity from their session cookies, retrying
 * once through the refresh token when the short-lived access token expired.
 */
export async function getVerifiedProfile(): Promise<VerifiedProfile | null> {
  const cookieStore = await cookies();
  const accessToken = cookieStore.get(AUTH_COOKIES.accessToken)?.value;
  const refreshToken = cookieStore.get(AUTH_COOKIES.refreshToken)?.value;

  let response = accessToken ? await fetchProfile(accessToken) : null;

  if ((!response || response.status === 401) && refreshToken) {
    const refreshed = await refreshAccessToken(refreshToken);
    if (refreshed) response = await fetchProfile(refreshed);
  }

  if (!response || !response.ok) return null;
  return (await response.json()) as VerifiedProfile;
}

export function landingSupportUrl(path: string): string {
  return `${LANDING_BASE_URL}/api/support/${path.replace(/^\/+/, "")}`;
}

export function supportKeyHeaders(): Record<string, string> {
  const key = process.env.SUPPORT_API_KEY;
  if (!key) throw new Error("SUPPORT_API_KEY is not set");
  return { "x-support-key": key };
}
