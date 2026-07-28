import crypto from 'crypto';
import { RefreshToken } from '../models/RefreshToken.js';
import { signAccessToken, signRefreshToken, verifyRefreshToken } from '../utils/jwt.js';
import { env } from '../config/env.js';
import { ApiError } from '../utils/ApiError.js';
import { ErrorCodes } from '../utils/errorCodes.js';

const hashToken = (token) => crypto.createHash('sha256').update(token).digest('hex');

function parseExpiryToDate(expiresIn) {
  const match = /^(\d+)([smhd])$/.exec(expiresIn);
  const ms = match
    ? { s: 1000, m: 60000, h: 3600000, d: 86400000 }[match[2]] * Number(match[1])
    : 30 * 86400000;
  return new Date(Date.now() + ms);
}

/** Issues a fresh access + refresh token pair and persists the refresh token hash. */
export async function issueTokenPair(user) {
  const payload = { sub: user.id, role: user.role };
  const accessToken = signAccessToken(payload);
  const refreshToken = signRefreshToken(payload);

  await RefreshToken.create({
    user: user._id,
    tokenHash: hashToken(refreshToken),
    expiresAt: parseExpiryToDate(env.jwt.refreshExpiresIn),
  });

  return { accessToken, refreshToken };
}

/** Verifies + rotates a refresh token. Throws if invalid, expired, revoked, or reused. */
export async function rotateRefreshToken(oldRefreshToken) {
  let payload;
  try {
    payload = verifyRefreshToken(oldRefreshToken);
  } catch {
    throw ApiError.unauthorized(ErrorCodes.REFRESH_TOKEN_INVALID, 'Invalid or expired refresh token');
  }

  const tokenHash = hashToken(oldRefreshToken);
  const stored = await RefreshToken.findOne({ tokenHash });

  if (!stored) {
    throw ApiError.unauthorized(ErrorCodes.REFRESH_TOKEN_INVALID, 'Refresh token not recognized');
  }
  if (stored.revokedAt) {
    throw ApiError.unauthorized(ErrorCodes.REFRESH_TOKEN_REUSED, 'Refresh token was already used');
  }

  const newAccessToken = signAccessToken({ sub: payload.sub, role: payload.role });
  const newRefreshToken = signRefreshToken({ sub: payload.sub, role: payload.role });

  stored.revokedAt = new Date();
  stored.replacedByHash = hashToken(newRefreshToken);
  await stored.save();

  await RefreshToken.create({
    user: stored.user,
    tokenHash: hashToken(newRefreshToken),
    expiresAt: parseExpiryToDate(env.jwt.refreshExpiresIn),
  });

  return { accessToken: newAccessToken, refreshToken: newRefreshToken, userId: stored.user.toString() };
}

export async function revokeRefreshToken(refreshToken) {
  const tokenHash = hashToken(refreshToken);
  await RefreshToken.updateOne({ tokenHash, revokedAt: null }, { revokedAt: new Date() });
}
