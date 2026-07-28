import mongoose from 'mongoose';
import { toJSONPlugin } from '../utils/mongoosePlugins.js';

const otpSchema = new mongoose.Schema(
  {
    mobile: { type: String, required: true, trim: true, match: /^[6-9]\d{9}$/ },
    codeHash: { type: String, required: true, private: true },
    purpose: { type: String, enum: ['login', 'signup'], required: true },
    attempts: { type: Number, default: 0 },
    consumedAt: { type: Date, default: null },
    expiresAt: { type: Date, required: true },
  },
  { timestamps: true }
);

// TTL index — Mongo auto-deletes the document once expiresAt passes.
otpSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
otpSchema.index({ mobile: 1, createdAt: -1 });

toJSONPlugin(otpSchema);

export const Otp = mongoose.model('Otp', otpSchema);
