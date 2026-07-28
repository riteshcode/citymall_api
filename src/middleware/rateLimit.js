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

/** Tighter limiter for auth verify endpoints to slow brute force. */
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  handler,
});
