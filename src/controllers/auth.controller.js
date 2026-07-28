import { catchAsync } from '../utils/catchAsync.js';
import { sendSuccess } from '../utils/ApiResponse.js';
import { User } from '../models/User.js';
import * as otpService from '../services/otp.service.js';
import * as authService from '../services/auth.service.js';

export const sendOtp = catchAsync(async (req, res) => {
  const { mobile, purpose } = req.body;
  const { expiresAt, ttlMinutes } = await otpService.sendOtp(mobile, purpose);
  sendSuccess(res, { data: { mobile, expiresAt, ttlMinutes } });
});

export const verifyOtp = catchAsync(async (req, res) => {
  const { mobile, code, purpose, name } = req.body;
  await otpService.verifyOtp(mobile, code, purpose);

  let user = await User.findOne({ mobile });
  let isNewUser = false;

  if (!user) {
    user = await User.create({ mobile, name: name || 'Aali Customer', isVerified: true });
    isNewUser = true;
  } else if (!user.isVerified) {
    user.isVerified = true;
    await user.save();
  }

  const { accessToken, refreshToken } = await authService.issueTokenPair(user);
  sendSuccess(res, { statusCode: isNewUser ? 201 : 200, data: { user, accessToken, refreshToken, isNewUser } });
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
