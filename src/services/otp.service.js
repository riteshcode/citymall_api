import { Otp } from '../models/Otp.js';
import { generateOtpCode, hashOtp, compareOtp } from '../utils/otp.js';
import { getSmsProvider } from './sms.provider.js';
import { env } from '../config/env.js';
import { ApiError } from '../utils/ApiError.js';
import { ErrorCodes } from '../utils/errorCodes.js';

export async function sendOtp(mobile, purpose) {
  const code = generateOtpCode(env.otp.length);
  const codeHash = await hashOtp(code);
  const expiresAt = new Date(Date.now() + env.otp.ttlMinutes * 60 * 1000);

  await Otp.create({ mobile, codeHash, purpose, expiresAt });
  await getSmsProvider().sendOtp(mobile, code);

  return { expiresAt, ttlMinutes: env.otp.ttlMinutes };
}

export async function verifyOtp(mobile, code, purpose) {
  const otpDoc = await Otp.findOne({ mobile, purpose, consumedAt: null }).sort({ createdAt: -1 });

  if (!otpDoc) {
    throw ApiError.badRequest(ErrorCodes.OTP_NOT_FOUND, 'No pending OTP found for this mobile number. Request a new one.');
  }

  if (otpDoc.expiresAt.getTime() < Date.now()) {
    throw ApiError.badRequest(ErrorCodes.OTP_EXPIRED, 'This OTP has expired. Request a new one.');
  }

  if (otpDoc.attempts >= env.otp.maxAttempts) {
    throw ApiError.badRequest(ErrorCodes.OTP_MAX_ATTEMPTS, 'Maximum verification attempts exceeded. Request a new OTP.');
  }

  const isMatch = await compareOtp(code, otpDoc.codeHash);
  if (!isMatch) {
    otpDoc.attempts += 1;
    await otpDoc.save();
    throw ApiError.badRequest(ErrorCodes.OTP_INVALID, 'Incorrect OTP');
  }

  otpDoc.consumedAt = new Date();
  await otpDoc.save();
}
