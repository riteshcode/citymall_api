import mongoose from 'mongoose';
import { toJSONPlugin } from '../utils/mongoosePlugins.js';
import { addressSchema } from './shared/address.js';

const userSchema = new mongoose.Schema(
  {
    mobile: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      match: /^[6-9]\d{9}$/,
    },
    name: { type: String, required: true, trim: true },
    // Admin / rider only (customers sign in with an OTP). `sparse` so the many users without one don't collide.
    username: { type: String, unique: true, sparse: true, lowercase: true, trim: true, minlength: 3, maxlength: 30, match: /^[a-z0-9._]+$/ },
    passwordHash: { type: String, select: false, private: true },
    passwordChangedAt: { type: Date },
    // Login throttling (atomic counter; see staff-auth.service.js)
    failedLoginAttempts: { type: Number, default: 0, private: true },
    lockUntil: { type: Date, private: true },
    email: { type: String, trim: true, lowercase: true, default: undefined },
    role: { type: String, enum: ['customer', 'admin', 'rider'], default: 'customer' },
    addresses: { type: [addressSchema], default: [] },
    isVerified: { type: Boolean, default: false },
    // false blocks login and every authenticated call (used to deactivate riders).
    isActive: { type: Boolean, default: true },
    refreshTokenVersion: { type: Number, default: 0, private: true },
  },
  { timestamps: true }
);

toJSONPlugin(userSchema);

userSchema.methods.getDefaultAddress = function () {
  return this.addresses.find((a) => a.isDefault) || this.addresses[0] || null;
};

export const User = mongoose.model('User', userSchema);
