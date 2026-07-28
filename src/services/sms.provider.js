import { logger } from '../config/logger.js';
import { env } from '../config/env.js';

/**
 * Pluggable SMS provider interface. Every provider must implement:
 *   sendOtp(mobile: string, code: string): Promise<void>
 * Swap SMS_PROVIDER in .env and add a case below to wire in a real gateway
 * (MSG91, Twilio, Gupshup, etc.) without touching otp.service.js.
 */

// Dev/test convenience only: remembers the last code sent per mobile so the
// test suite can complete the OTP flow without a real SMS gateway. Never
// read from production code paths.
const lastOtpByMobile = new Map();

export function getLastOtpForTesting(mobile) {
  return lastOtpByMobile.get(mobile);
}

const consoleProvider = {
  async sendOtp(mobile, code) {
    lastOtpByMobile.set(mobile, code);
    logger.info(`[SMS:console-stub] OTP for ${mobile} is ${code}`);
  },
};

const providers = {
  console: consoleProvider,
  // twilio: twilioProvider, // add real implementations here
};

export function getSmsProvider() {
  return providers[env.otp.smsProvider] || consoleProvider;
}
