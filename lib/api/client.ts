import type { ZodType } from "zod";
import { ApiError } from "@/lib/api/errors";
import type { ApiClientConfig, ApiRequestOptions } from "@/lib/api/types";
import { clearPersistedCache } from "@/lib/api/persist";

const runtimeConfig: ApiClientConfig = {};

// A hung connection (dropped mid-response by an intermediary, a backend
// worker that stalls without ever closing the socket, ...) otherwise leaves
// the caller's fetch pending forever — no resolve, no reject — which for a
// React Query mutation means "Thinking…" never clears and there is no error
// to recover from. Bound every request so it always eventually settles.
// Comfortably under the backend's gunicorn worker timeout (120s) so a
// request that's merely slow (not stuck) still has room to finish normally.
const DEFAULT_REQUEST_TIMEOUT_MS = 100_000;

export function configureApiClient(config: ApiClientConfig): void {
  Object.assign(runtimeConfig, config);
}

function resolveBaseUrl(): string {
  // In the browser, we always route through our secure proxy to leverage HttpOnly cookies.
  if (typeof window !== "undefined") {
    return "/api/proxy";
  }

  const baseUrl =
    runtimeConfig.baseUrl ?? process.env.NEXT_PUBLIC_API_BASE_URL ?? "";

  if (!baseUrl) {
    throw new Error("NEXT_PUBLIC_API_BASE_URL is not set.");
  }

  return baseUrl.replace(/\/$/, "");
}

/**
 * The Django backend's own origin (scheme + host + port).
 *
 * Every JSON API call goes through `/api/proxy` on this app's own origin (see
 * `resolveBaseUrl`), but a handful of API responses embed a *file* URL —
 * `FileField.url` — that is relative in local dev (`/media/...`, plain
 * filesystem storage) and absolute in production (Cloudinary's CDN). A
 * relative one resolves against whichever origin fetches it, which in a
 * browser is this app's origin, not the backend that actually serves the
 * file — the same problem the Hub's attachments solve by having the backend
 * declare its `media_origin` over the websocket handshake. REST responses
 * have no equivalent handshake, so this derives it the way `next.config.ts`'s
 * `backendImagePattern()` already does for `<Image>` remote patterns.
 */
export function backendOrigin(): string {
  const raw = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://127.0.0.1:8000/api/";
  try {
    const url = new URL(raw);
    return url.origin;
  } catch {
    return "";
  }
}

/** A possibly-relative file URL from the API, made absolute against the
 * backend origin. Already-absolute URLs (Cloudinary in production) pass
 * through unchanged — same rule as `components/hub/hub-utils.ts`'s
 * `resolveMediaUrl`, kept here too since this call site has no socket-declared
 * origin to reuse that one with. */
export function resolveBackendFileUrl(fileUrl: string): string {
  if (!fileUrl) return "";
  if (/^https?:\/\//.test(fileUrl)) return fileUrl;
  return `${backendOrigin()}${fileUrl}`;
}

function buildUrl(endpoint: string): string {
  if (/^https?:\/\//.test(endpoint)) {
    return endpoint;
  }

  const baseUrl = resolveBaseUrl();
  const normalizedEndpoint = endpoint.startsWith("/")
    ? endpoint
    : `/${endpoint}`;

  // Avoid double "/api/api/..." when base URL already includes "/api".
  const normalizedBase = baseUrl.endsWith("/api")
    ? baseUrl.slice(0, -4)
    : baseUrl;
  const endpointWithoutApiPrefix = normalizedEndpoint.replace(
    /^\/api(?=\/)/,
    "",
  );

  return `${normalizedBase}/api${endpointWithoutApiPrefix}`;
}

async function forceClientLogoutAndRedirect(): Promise<void> {
  if (typeof window === "undefined") return;

  try {
    await fetch("/api/auth/logout", {
      method: "POST",
      credentials: "include",
    });
  } catch {
    // Ignore; proxy may have already cleared cookies.
  }

  // Drop any persisted React Query cache so the login page (which reloads) does
  // not restore the expired session's data.
  clearPersistedCache();
  window.location.replace("/login");
}

async function resolveAuthToken(
  authToken?: string | null,
): Promise<string | null> {
  if (authToken !== undefined) {
    return authToken;
  }

  if (!runtimeConfig.getAuthToken) {
    return null;
  }

  return runtimeConfig.getAuthToken();
}

export async function apiClient<T>(
  endpoint: string,
  options: ApiRequestOptions = {},
): Promise<T> {
  const {
    method = "GET",
    body,
    headers,
    authToken,
    credentials = "include",
    signal,
    ...rest
  } = options;

  // Compose the caller's own abort signal (if any) with the default
  // timeout, so an explicit signal a caller passes still works as expected.
  const timeoutSignal = AbortSignal.timeout(DEFAULT_REQUEST_TIMEOUT_MS);
  const requestSignal = signal ? AbortSignal.any([signal, timeoutSignal]) : timeoutSignal;

  const token = await resolveAuthToken(authToken);

  const requestHeaders = new Headers(headers ?? {});

  // Forward UI language to backend so responses are localised
  if (
    typeof window !== "undefined" &&
    !requestHeaders.has("X-Language")
  ) {
    const lang = localStorage.getItem("prepiq_lang") ?? "en";
    requestHeaders.set("X-Language", lang);
  }

  if (
    body !== undefined &&
    !requestHeaders.has("Content-Type") &&
    !(body instanceof FormData)
  ) {
    requestHeaders.set("Content-Type", "application/json");
  }

  if (token && !requestHeaders.has("Authorization")) {
    requestHeaders.set("Authorization", `Bearer ${token}`);
  }

  let response: Response;
  try {
    response = await fetch(buildUrl(endpoint), {
      method,
      credentials,
      headers: requestHeaders,
      body:
        body === undefined || body instanceof FormData
          ? (body as BodyInit | undefined)
          : JSON.stringify(body),
      signal: requestSignal,
      ...rest,
    });
  } catch (error) {
    if (requestSignal.aborted && !signal?.aborted) {
      throw new ApiError(
        "The request took too long to respond. Please try again.",
        0,
        { code: "timeout" },
      );
    }
    throw error;
  }

  if (response.status === 401) {
    const authCleared = response.headers.get("x-prepiq-auth-cleared") === "1";
    if (authCleared) {
      await forceClientLogoutAndRedirect();
      return Promise.reject(new Error("Authentication expired"));
    }

    if (runtimeConfig.onUnauthorized) {
      await runtimeConfig.onUnauthorized();
    }
  }

  if (!response.ok) {
    throw await ApiError.fromResponse(response);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  const contentType = response.headers.get("content-type") ?? "";

  if (contentType.includes("application/json")) {
    return (await response.json()) as T;
  }

  return (await response.text()) as T;
}

export async function apiClientWithSchema<T>(
  endpoint: string,
  schema: ZodType<T>,
  options: ApiRequestOptions = {},
): Promise<T> {
  const data = await apiClient<unknown>(endpoint, options);
  return schema.parse(data);
}
