import { ZodError } from 'zod';
import { ApiError } from '../utils/ApiError.js';
import { ErrorCodes } from '../utils/errorCodes.js';

/**
 * Validates req[body|query|params] against zod schemas and replaces them
 * with the parsed (typed, defaulted) values. Schemas should use `.strict()`
 * (see utils/zodHelpers.js) so unknown fields are rejected.
 *
 * @param {{ body?: import('zod').ZodSchema, query?: import('zod').ZodSchema, params?: import('zod').ZodSchema }} schemas
 */
export const validate = (schemas) => (req, res, next) => {
  try {
    if (schemas.params) req.params = schemas.params.parse(req.params);
    if (schemas.query) req.query = schemas.query.parse(req.query);
    if (schemas.body) req.body = schemas.body.parse(req.body);
    next();
  } catch (err) {
    if (err instanceof ZodError) {
      const details = err.issues.map((i) => ({
        path: i.path.join('.'),
        message: i.message,
      }));
      return next(ApiError.badRequest(ErrorCodes.VALIDATION_ERROR, 'Request validation failed', details));
    }
    next(err);
  }
};
