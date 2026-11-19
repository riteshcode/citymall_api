import { verifyAccessToken } from '../utils/jwt.js';
import { ApiError } from '../utils/ApiError.js';
import { ErrorCodes } from '../utils/errorCodes.js';
import { User } from '../models/User.js';
import { catchAsync } from '../utils/catchAsync.js';

/** Requires a valid access token; attaches req.user (lean auth payload) and req.userDoc (fresh doc). */
export const authenticate = catchAsync(async (req, res, next) => {
  const header = req.headers.authorization || '';
  const [scheme, token] = header.split(' ');

  if (scheme !== 'Bearer' || !token) {
    throw ApiError.unauthorized(ErrorCodes.UNAUTHORIZED, 'Missing or malformed Authorization header');
  }

  let payload;
  try {
    payload = verifyAccessToken(token);
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      throw ApiError.unauthorized(ErrorCodes.TOKEN_EXPIRED, 'Access token expired');
    }
    throw ApiError.unauthorized(ErrorCodes.TOKEN_INVALID, 'Invalid access token');
  }

  const user = await User.findById(payload.sub);
  if (!user) {
    throw ApiError.unauthorized(ErrorCodes.TOKEN_INVALID, 'User no longer exists');
  }

  if (user.isActive === false) {
    throw ApiError.forbidden(ErrorCodes.ACCOUNT_DISABLED, 'This account has been deactivated');
  }

  // A password change / reset ends every earlier session: tokens issued before it are refused.
  if (user.passwordChangedAt && payload.iat * 1000 < Math.floor(user.passwordChangedAt.getTime() / 1000) * 1000) {
    throw ApiError.unauthorized(ErrorCodes.TOKEN_INVALID, 'Your password was changed. Please sign in again.');
  }

  req.user = { id: user.id, mobile: user.mobile, role: user.role };
  req.userDoc = user;
  next();
});

/** Like `authenticate`, but a request WITHOUT an Authorization header goes through anonymously (req.user stays unset). */
export const optionalAuthenticate = (req, res, next) => {
  if (!req.headers.authorization) return next();
  return authenticate(req, res, next);
};

/** Restricts a route to one or more roles. Use after `authenticate`. */
export const requireRole =
  (...roles) =>
  (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return next(ApiError.forbidden(ErrorCodes.FORBIDDEN, 'You do not have access to this resource'));
    }
    next();
  };
