import { randomUUID } from 'crypto';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';

export function signAccessToken(payload) {
  return jwt.sign(payload, env.jwt.accessSecret, { expiresIn: env.jwt.accessExpiresIn });
}

export function signRefreshToken(payload) {
  // jwtid makes every refresh token unique even when issued in the same second for the
  // same user. Without it, two logins (or login + immediate refresh) produce byte-identical
  // JWTs and collide on RefreshToken.tokenHash's unique index.
  return jwt.sign(payload, env.jwt.refreshSecret, {
    expiresIn: env.jwt.refreshExpiresIn,
    jwtid: randomUUID(),
  });
}

export function verifyAccessToken(token) {
  return jwt.verify(token, env.jwt.accessSecret);
}

export function verifyRefreshToken(token) {
  return jwt.verify(token, env.jwt.refreshSecret);
}
