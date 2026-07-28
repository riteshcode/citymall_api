import mongoose from 'mongoose';
import { toJSONPlugin } from '../utils/mongoosePlugins.js';

/**
 * Persisted refresh tokens (hashed) so /auth/logout and /auth/refresh can
 * revoke and rotate reliably, and reused/stolen tokens can be detected.
 */
const refreshTokenSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    tokenHash: { type: String, required: true, unique: true, private: true },
    expiresAt: { type: Date, required: true },
    revokedAt: { type: Date, default: null },
    replacedByHash: { type: String, default: null, private: true },
  },
  { timestamps: true }
);

refreshTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
refreshTokenSchema.index({ user: 1 });

toJSONPlugin(refreshTokenSchema);

export const RefreshToken = mongoose.model('RefreshToken', refreshTokenSchema);
