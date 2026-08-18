export class ApiError extends Error {
  readonly status: number;
  readonly details: unknown;

  constructor(message: string, status: number, details?: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.details = details;
  }

  static async fromResponse(response: Response): Promise<ApiError> {
    const contentType = response.headers.get("content-type") ?? "";
    let details: unknown = null;

    try {
      if (contentType.includes("application/json")) {
        details = await response.json();
      } else {
        details = await response.text();
      }
    } catch {
      details = null;
    }

    const message = ApiError.extractMessage(details, response.statusText || "Request failed");

    return new ApiError(message, response.status, details);
  }

  /**
   * core/utils.py's `error_response()` shape is `{success, message, error:
   * {code, details}}`, where `message` goes through `translate()` server-side
   * — falling back to the raw key untranslated (e.g. "BRANCH_ASSIGNMENT_
   * INVALID") when no translation entry exists. Several call sites also put
   * the actual human-readable reason under `error.details.detail` instead
   * (Django ValidationError text, a plan-tier restriction, etc.), which used
   * to be shadowed entirely by the untranslated code winning first. Prefer
   * an actual sentence wherever one is available; only fall back to a raw
   * SCREAMING_SNAKE_CASE code when nothing better exists.
   */
  private static looksLikeRawCode(text: string): boolean {
    return /^[A-Z][A-Z0-9_]*$/.test(text);
  }

  private static extractMessage(details: unknown, fallback: string, depth = 0): string {
    if (typeof details !== "object" || details === null) {
      return fallback;
    }

    const record = details as Record<string, unknown>;

    if (typeof record.message === "string" && !ApiError.looksLikeRawCode(record.message)) {
      return record.message;
    }

    // error_response()'s `error: {code, details}` — details.detail is where
    // dynamic, human-written text (validation errors, plan restrictions)
    // actually lives when `message` is just an untranslated code.
    if (typeof record.error === "object" && record.error !== null) {
      const errorRecord = record.error as Record<string, unknown>;
      const nestedDetails = errorRecord.details;
      if (typeof nestedDetails === "object" && nestedDetails !== null) {
        const detail = (nestedDetails as Record<string, unknown>).detail;
        if (typeof detail === "string") return detail;
      }
      if (typeof nestedDetails === "string") return nestedDetails;
    }

    if (typeof record.detail === "string") {
      return record.detail;
    }

    // DRF wraps a raised exception's dict `detail` (e.g. PermissionDenied({
    // 'code': ..., 'detail': '...' }), used by impersonation's read-only
    // guard and elsewhere) as `{"detail": {...}}` — one level nested rather
    // than a flat string. Recurse once so that inner `detail`/`message`
    // still surfaces instead of silently falling back to "Forbidden".
    if (depth === 0 && typeof record.detail === "object" && record.detail !== null) {
      const nested = ApiError.extractMessage(record.detail, "", depth + 1);
      if (nested) return nested;
    }

    // A raw code beats nothing — return it now that every readable option
    // above has been exhausted.
    if (typeof record.message === "string") {
      return record.message;
    }

    if (typeof record.error === "string") {
      return record.error;
    }

    const firstFieldError = Object.values(record).find((value) =>
      Array.isArray(value) ? typeof value[0] === "string" : typeof value === "string",
    );

    if (Array.isArray(firstFieldError) && typeof firstFieldError[0] === "string") {
      return firstFieldError[0];
    }

    if (typeof firstFieldError === "string") {
      return firstFieldError;
    }

    return fallback;
  }
}
