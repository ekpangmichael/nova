export class ApiError extends Error {
  statusCode: number;
  code: string;
  details?: unknown;

  constructor(
    statusCode: number,
    code: string,
    message: string,
    details?: unknown
  ) {
    super(message);
    this.name = "ApiError";
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
  }
}

export const badRequest = (message: string, details?: unknown) =>
  new ApiError(400, "bad_request", message, details);
export const unauthorized = (message: string, details?: unknown) =>
  new ApiError(401, "unauthorized", message, details);
export const notFound = (message: string, details?: unknown) =>
  new ApiError(404, "not_found", message, details);
export const conflict = (message: string, details?: unknown) =>
  new ApiError(409, "conflict", message, details);
export const serviceUnavailable = (message: string, details?: unknown) =>
  new ApiError(503, "service_unavailable", message, details);
