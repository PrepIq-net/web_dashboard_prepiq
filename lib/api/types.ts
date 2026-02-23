export type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

export type ApiRequestOptions = Omit<
  RequestInit,
  "method" | "body" | "headers" | "credentials"
> & {
  method?: HttpMethod;
  body?: unknown;
  headers?: HeadersInit;
  authToken?: string | null;
  credentials?: RequestCredentials;
};

export type ApiClientConfig = {
  baseUrl?: string;
  getAuthToken?: () => string | null | Promise<string | null>;
  onUnauthorized?: () => void | Promise<void>;
};
