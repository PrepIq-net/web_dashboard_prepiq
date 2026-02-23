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

    const message =
      typeof details === "object" &&
      details !== null &&
      "message" in details &&
      typeof (details as Record<string, unknown>).message === "string"
        ? ((details as Record<string, string>).message ?? "Request failed")
        : response.statusText || "Request failed";

    return new ApiError(message, response.status, details);
  }
}
