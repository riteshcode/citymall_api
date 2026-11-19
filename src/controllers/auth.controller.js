import { catchAsync } from '../utils/catchAsync.js';
import { sendSuccess } from '../utils/ApiResponse.js';
import { User } from '../models/User.js';
import * as otpService from '../services/otp.service.js';
import * as authService from '../services/auth.service.js';
import * as staffAuth from '../services/staff-auth.service.js';
import { env } from '../config/env.js';
import { ApiError } from '../utils/ApiError.js';
import { ErrorCodes } from '../utils/errorCodes.js';

/** OTP login is for customers only: a mobile that belongs to an admin / rider must use username + password. */
async function assertNotStaffMobile(mobile) {
  if (await User.exists({ mobile, role: { $in: staffAuth.STAFF_ROLES } })) {
    throw ApiError.forbidden(ErrorCodes.USE_PASSWORD_LOGIN, 'This account signs in with a username and password');
  }
}

/** The OTP is echoed in the response ONLY for local development with the console SMS stub - never in production. */
const echoOtpCode = () => !env.isProd && env.otp.smsProvider === 'console';

export const sendOtp = catchAsync(async (req, res) => {
  const { mobile, purpose } = req.body;
  await assertNotStaffMobile(mobile); // before anything is generated or sent
  const { expiresAt, ttlMinutes, code } = await otpService.sendOtp(mobile, purpose);
  sendSuccess(res, { data: { mobile, expiresAt, ttlMinutes, ...(echoOtpCode() ? { code } : {}) } });
});

export const verifyOtp = catchAsync(async (req, res) => {
  const { mobile, code, purpose, name } = req.body;
  await assertNotStaffMobile(mobile);
  await otpService.verifyOtp(mobile, code, purpose);

  let user = await User.findOne({ mobile });
  let isNewUser = false;

  if (!user) {
    user = await User.create({ mobile, name: name || 'Aali Customer', isVerified: true });
    isNewUser = true;
  } else if (user.isActive === false) {
    throw ApiError.forbidden(ErrorCodes.ACCOUNT_DISABLED, 'This account has been deactivated');
  } else if (!user.isVerified) {
    user.isVerified = true;
    await user.save();
  }

  const { accessToken, refreshToken } = await authService.issueTokenPair(user);
  sendSuccess(res, { statusCode: isNewUser ? 201 : 200, data: { user, accessToken, refreshToken, isNewUser } });
});

/** POST /auth/staff/login - same response shape as /auth/otp/verify. */
export const staffLogin = catchAsync(async (req, res) => {
  const { user, accessToken, refreshToken } = await staffAuth.staffLogin(req.body);
  sendSuccess(res, { data: { user, accessToken, refreshToken, isNewUser: false } });
});

/** PATCH /me/password - returns a fresh token pair for the current session; every other session is signed out. */
export const changePassword = catchAsync(async (req, res) => {
  sendSuccess(res, { data: await staffAuth.changeOwnPassword(req.user.id, req.body) });
});

export const refresh = catchAsync(async (req, res) => {
  const { refreshToken } = req.body;
  const result = await authService.rotateRefreshToken(refreshToken);
  sendSuccess(res, { data: { accessToken: result.accessToken, refreshToken: result.refreshToken } });
});

export const logout = catchAsync(async (req, res) => {
  await authService.revokeRefreshToken(req.body.refreshToken);
  sendSuccess(res, { data: { message: 'Logged out' } });
});

export const getMe = catchAsync(async (req, res) => {
  sendSuccess(res, { data: req.userDoc });
});

export const updateMe = catchAsync(async (req, res) => {
  Object.assign(req.userDoc, req.body);
  await req.userDoc.save();
  sendSuccess(res, { data: req.userDoc });
});
