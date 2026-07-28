import mongoose from 'mongoose';
import { toJSONPlugin } from '../utils/mongoosePlugins.js';

/**
 * One row per successful redemption of a coupon by a user on an order.
 * Backs per-user usage limit checks (Coupon.perUserLimit) without having
 * to scan the Order collection.
 */
const couponRedemptionSchema = new mongoose.Schema(
  {
    coupon: { type: mongoose.Schema.Types.ObjectId, ref: 'Coupon', required: true },
    code: { type: String, required: true, uppercase: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    order: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', required: true },
  },
  { timestamps: true }
);

couponRedemptionSchema.index({ code: 1, user: 1 });

toJSONPlugin(couponRedemptionSchema);

export const CouponRedemption = mongoose.model('CouponRedemption', couponRedemptionSchema);
