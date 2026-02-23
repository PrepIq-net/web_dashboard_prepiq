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

  private static extractMessage(details: unknown, fallback: string): string {
    if (typeof details !== "object" || details === null) {
      return fallback;
    }

    const record = details as Record<string, unknown>;

    if (typeof record.message === "string") {
      return record.message;
    }

    if (typeof record.error === "string") {
      return record.error;
    }

    if (typeof record.detail === "string") {
      return record.detail;
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
