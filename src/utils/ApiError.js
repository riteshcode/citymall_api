export class ApiError extends Error {
  /**
   * @param {number} statusCode HTTP status code
   * @param {string} code Stable machine-readable error code (see errorCodes.js)
   * @param {string} message Human-readable (English) fallback message
   * @param {any} [details] Optional extra info (validation issues, etc.)
   */
  constructor(statusCode, code, message, details) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    this.isApiError = true;
    Error.captureStackTrace(this, this.constructor);
  }

  static badRequest(code, message, details) {
    return new ApiError(400, code, message, details);
  }

  static unauthorized(code, message = 'Unauthorized') {
    return new ApiError(401, code, message);
  }

  static forbidden(code, message = 'Forbidden') {
    return new ApiError(403, code, message);
  }

  static notFound(code, message = 'Not found') {
    return new ApiError(404, code, message);
  }

  static conflict(code, message) {
    return new ApiError(409, code, message);
  }

  static tooMany(code, message) {
    return new ApiError(429, code, message);
  }

  static internal(message = 'Internal server error') {
    return new ApiError(500, 'INTERNAL_ERROR', message);
  }
}
