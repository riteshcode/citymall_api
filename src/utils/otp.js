import crypto from 'crypto';
import bcrypt from 'bcrypt';

const SALT_ROUNDS = 10;

export function generateOtpCode(length = 6) {
  const min = 10 ** (length - 1);
  const max = 10 ** length - 1;
  return String(crypto.randomInt(min, max + 1));
}

export function hashOtp(code) {
  return bcrypt.hash(code, SALT_ROUNDS);
}

export function compareOtp(code, hash) {
  return bcrypt.compare(code, hash);
}
