import rateLimit from 'express-rate-limit';
import { env } from '../config/env.js';
import { ApiError } from '../utils/ApiError.js';
import { ErrorCodes } from '../utils/errorCodes.js';

const handler = (req, res, next) => {
  next(ApiError.tooMany(ErrorCodes.RATE_LIMITED, 'Too many requests, please try again later'));
};

/** General-purpose limiter applied to the whole API. */
export const globalLimiter = rateLimit({
  windowMs: env.rateLimit.windowMinutes * 60 * 1000,
  max: env.rateLimit.max,
  standardHeaders: true,
  legacyHeaders: false,
  handler,
});

/** Stricter limiter for OTP send — keyed by mobile number, not just IP. */
export const otpSendLimiter = rateLimit({
  windowMs: env.otp.sendWindowMinutes * 60 * 1000,
  max: env.otp.sendLimit,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.body?.mobile || req.ip,
  handler: (req, res, next) => {
    next(
      ApiError.tooMany(
        ErrorCodes.OTP_SEND_RATE_LIMITED,
        `Too many OTP requests for this mobile number. Try again after ${env.otp.sendWindowMinutes} minutes.`
      )
    );
  },
});

/**
 * Staff login: two independent buckets that only count FAILED attempts (a successful sign-in never uses them up).
 * Per IP stops one machine spraying many usernames; per username stops a botnet hammering one account.
 */
export function createStaffLoginLimiters({ ipLimit, userLimit, windowMs }) {
  const common = { windowMs, skipSuccessfulRequests: true, standardHeaders: true, legacyHeaders: false, handler };
  return {
    ip: rateLimit({ ...common, max: ipLimit }),
    user: rateLimit({
      ...common,
      max: userLimit,
      keyGenerator: (req) => `user:${String(req.body?.username ?? '').trim().toLowerCase()}`,
    }),
  };
}

const staffLimiters = createStaffLoginLimiters({
  ipLimit: env.staff.loginIpLimit,
  userLimit: env.staff.loginUserLimit,
  windowMs: env.staff.loginWindowMinutes * 60 * 1000,
});
export const staffLoginIpLimiter = staffLimiters.ip;
export const staffLoginUserLimiter = staffLimiters.user;

/** GET /geo/reverse is public and each miss costs a provider call, so it is limited per IP. */
export const createGeoLimiter = (max) => rateLimit({ windowMs: 60 * 1000, max, standardHeaders: true, legacyHeaders: false, handler });
export const geoLimiter = createGeoLimiter(env.geo.rateLimitPerMinute);

/** Tighter limiter for auth verify endpoints to slow brute force. */
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  handler,
});
