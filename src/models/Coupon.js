import mongoose from 'mongoose';
import { toJSONPlugin } from '../utils/mongoosePlugins.js';
import { bilingualSchema } from './shared/bilingual.js';

const couponSchema = new mongoose.Schema(
  {
    code: { type: String, required: true, unique: true, uppercase: true, trim: true },
    // Optional offer text for the "Offers" screen, e.g. { en: "Flat 50 off on orders above 199", hi: "..." }.
    description: { type: bilingualSchema, default: undefined },
    type: { type: String, enum: ['flat', 'percent'], required: true },
    // flat -> paise; percent -> whole number percent (e.g. 10 = 10%)
    value: { type: Number, required: true, min: 0 },
    minOrderValue: { type: Number, default: 0, min: 0 }, // paise
    maxDiscount: { type: Number, default: null, min: 0 }, // paise; caps percent coupons
    startsAt: { type: Date, required: true },
    expiresAt: { type: Date, required: true },
    usageLimit: { type: Number, default: null, min: 0 }, // total redemptions across all users
    perUserLimit: { type: Number, default: 1, min: 0 },
    usedCount: { type: Number, default: 0, min: 0 },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

couponSchema.index({ code: 1, isActive: 1 });

toJSONPlugin(couponSchema);

export const Coupon = mongoose.model('Coupon', couponSchema);
