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
    email: { type: String, trim: true, lowercase: true, default: undefined },
    role: { type: String, enum: ['customer', 'admin'], default: 'customer' },
    addresses: { type: [addressSchema], default: [] },
    isVerified: { type: Boolean, default: false },
    refreshTokenVersion: { type: Number, default: 0, private: true },
  },
  { timestamps: true }
);

toJSONPlugin(userSchema);

userSchema.methods.getDefaultAddress = function () {
  return this.addresses.find((a) => a.isDefault) || this.addresses[0] || null;
};

export const User = mongoose.model('User', userSchema);
