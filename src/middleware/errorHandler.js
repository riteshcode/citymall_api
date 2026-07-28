import { logger } from '../config/logger.js';
import { ApiError } from '../utils/ApiError.js';
import { ErrorCodes } from '../utils/errorCodes.js';
import { env } from '../config/env.js';

export function notFoundHandler(req, res, next) {
  next(ApiError.notFound(ErrorCodes.NOT_FOUND, `Route not found: ${req.method} ${req.originalUrl}`));
}

// eslint-disable-next-line no-unused-vars
export function errorHandler(err, req, res, next) {
  let apiError = err;

  if (!(err instanceof ApiError)) {
    apiError = normalizeError(err);
  }

  if (apiError.statusCode >= 500) {
    logger.error(`${req.method} ${req.originalUrl} -> ${apiError.message}`, { stack: err.stack });
  } else if (!env.isTest) {
    logger.warn(`${req.method} ${req.originalUrl} -> [${apiError.code}] ${apiError.message}`);
  }

  const body = {
    success: false,
    data: null,
    error: {
      code: apiError.code,
      message: apiError.message,
      ...(apiError.details ? { details: apiError.details } : {}),
    },
  };

  res.status(apiError.statusCode).json(body);
}

function normalizeError(err) {
  // Mongoose validation error
  if (err.name === 'ValidationError' && err.errors) {
    const details = Object.values(err.errors).map((e) => ({ path: e.path, message: e.message }));
    return ApiError.badRequest(ErrorCodes.VALIDATION_ERROR, 'Validation failed', details);
  }

  // Mongoose bad ObjectId cast
  if (err.name === 'CastError') {
    return ApiError.badRequest(ErrorCodes.VALIDATION_ERROR, `Invalid value for field "${err.path}"`);
  }

  // Mongo duplicate key
  if (err.code === 11000) {
    const field = Object.keys(err.keyPattern || {})[0] || 'field';
    return ApiError.conflict(ErrorCodes.DUPLICATE_KEY, `Duplicate value for "${field}"`);
  }

  if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
    return ApiError.unauthorized(ErrorCodes.TOKEN_INVALID, 'Invalid or expired token');
  }

  if (err.type === 'entity.too.large') {
    return ApiError.badRequest(ErrorCodes.VALIDATION_ERROR, 'Request payload too large');
  }

  return ApiError.internal(env.isProd ? 'Something went wrong' : err.message);
}
