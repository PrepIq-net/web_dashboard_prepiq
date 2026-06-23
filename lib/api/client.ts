import type { ZodType } from "zod";
import { ApiError } from "@/lib/api/errors";
import type { ApiClientConfig, ApiRequestOptions } from "@/lib/api/types";

const runtimeConfig: ApiClientConfig = {};

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
    ...rest
  } = options;

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

  const response = await fetch(buildUrl(endpoint), {
    method,
    credentials,
    headers: requestHeaders,
    body:
      body === undefined || body instanceof FormData
        ? (body as BodyInit | undefined)
        : JSON.stringify(body),
    ...rest,
  });

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
