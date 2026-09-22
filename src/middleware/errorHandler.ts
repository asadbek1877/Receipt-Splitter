import type { Request, Response, NextFunction } from "express";

// Standard error response structure
interface ErrorResponse {
  success: false;
  error: string;
  code: number;
  details?: Record<string, string>;
}

// Custom error class with status code
export class APIError extends Error {
  constructor(
    public statusCode: number,
    public message: string,
    public details?: Record<string, string>
  ) {
    super(message);
    this.name = "APIError";
  }
}

// Error messages mapping
const ERROR_MESSAGES: Record<number, string> = {
  400: "Bad Request",
  401: "Unauthorized",
  403: "Forbidden",
  404: "Not Found",
  409: "Conflict",
  422: "Validation Error",
  500: "Internal Server Error",
  503: "Service Unavailable",
};

/**
 * Global error handler middleware
 * Normalizes error responses with consistent structure
 */
export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction
): Response<ErrorResponse> {
  let statusCode = 500;
  let message = "Internal Server Error";
  let details: Record<string, string> | undefined;

  // Extract status and message from various error types
  if (typeof err === "object" && err) {
    const errObj = err as any;

    // Check for status code
    if (errObj.statusCode) statusCode = Number(errObj.statusCode);
    else if (errObj.status) statusCode = Number(errObj.status);

    // Check for message
    if (errObj.message) message = String(errObj.message);

    // Check for validation details
    if (errObj.details) details = errObj.details;
  } else if (typeof err === "string") {
    message = err;
  }

  // Use default message if no message found
  if (!message || message === "undefined") {
    message = ERROR_MESSAGES[statusCode] || "An error occurred";
  }

  // Log server errors
  if (statusCode >= 500) {
    // eslint-disable-next-line no-console
    console.error("Server error:", {
      status: statusCode,
      message,
      error: err,
    });
  }

  const response: ErrorResponse = {
    success: false,
    error: message,
    code: statusCode,
  };

  if (details) {
    response.details = details;
  }

  return res.status(statusCode).json(response);
}
