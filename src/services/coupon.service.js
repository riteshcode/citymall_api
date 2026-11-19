import mongoose from 'mongoose';
import { Coupon } from '../models/Coupon.js';
import { CouponRedemption } from '../models/CouponRedemption.js';
import { ApiError } from '../utils/ApiError.js';
import { ErrorCodes } from '../utils/errorCodes.js';
import { computeCouponDiscount } from './pricing.service.js';

/**
 * Looks up a coupon by code and validates it against the given subtotal/user
 * WITHOUT mutating usage counters. Throws a clear ApiError code the client
 * can map to a bilingual message. Call this both when applying a coupon to
 * a cart and again inside the order transaction (never trust the cart's
 * cached state).
 *
 * @param {string} code
 * @param {{ subtotal: number, userId: string, session?: import('mongoose').ClientSession }} ctx
 */
export async function getEligibleCoupon(code, { subtotal, userId, session } = {}) {
  const coupon = await Coupon.findOne({ code: code.toUpperCase() }).session(session || null);
  if (!coupon) {
    throw ApiError.notFound(ErrorCodes.COUPON_NOT_FOUND, `Coupon "${code}" does not exist`);
  }

  if (!coupon.isActive) {
    throw ApiError.badRequest(ErrorCodes.COUPON_INACTIVE, 'This coupon is no longer active');
  }

  const now = new Date();
  if (now < coupon.startsAt) {
    throw ApiError.badRequest(ErrorCodes.COUPON_NOT_STARTED, 'This coupon is not active yet');
  }
  if (now > coupon.expiresAt) {
    throw ApiError.badRequest(ErrorCodes.COUPON_EXPIRED, 'This coupon has expired');
  }

  if (subtotal < coupon.minOrderValue) {
    throw ApiError.badRequest(
      ErrorCodes.COUPON_MIN_ORDER,
      `Add more items to your cart to use this coupon (minimum order value required)`,
      { minOrderValue: coupon.minOrderValue }
    );
  }

  if (coupon.usageLimit != null && coupon.usedCount >= coupon.usageLimit) {
    throw ApiError.badRequest(ErrorCodes.COUPON_USAGE_LIMIT_REACHED, 'This coupon has reached its usage limit');
  }

  if (coupon.perUserLimit != null && coupon.perUserLimit >= 0 && userId) {
    const userRedemptions = await CouponRedemption.countDocuments({ coupon: coupon._id, user: userId }).session(
      session || null
    );
    if (userRedemptions >= coupon.perUserLimit) {
      throw ApiError.badRequest(
        ErrorCodes.COUPON_PER_USER_LIMIT_REACHED,
        'You have already used this coupon the maximum number of times'
      );
    }
  }

  return coupon;
}

/** Records a successful redemption; call inside the order transaction after the order is created. */
export async function recordCouponRedemption(coupon, { userId, orderId, session }) {
  await Coupon.updateOne({ _id: coupon._id }, { $inc: { usedCount: 1 } }, { session });
  await CouponRedemption.create(
    [{ coupon: coupon._id, code: coupon.code, user: userId, order: orderId }],
    { session }
  );
}

export function previewDiscount(coupon, subtotal) {
  return computeCouponDiscount(coupon, subtotal);
}

/**
 * Coupons a customer could use right now, for the "Offers" screen: active, inside their dates, global usage limit not
 * exhausted. With a `userId`, coupons whose per-user limit that user has already used up are left out too.
 * (`minOrderValue` is NOT filtered: it is shown so the app can say "add Rs 50 more".)
 * @returns {Promise<{ code, type, value, minOrderValue, maxDiscount, expiresAt, description }[]>} soonest-expiring first
 */
export async function listAvailableCoupons(userId = null) {
  const now = new Date();
  const candidates = await Coupon.find({
    isActive: true,
    startsAt: { $lte: now },
    expiresAt: { $gte: now },
    perUserLimit: { $ne: 0 }, // 0 uses per user = nobody can ever apply it
    $or: [{ usageLimit: null }, { $expr: { $lt: ['$usedCount', '$usageLimit'] } }],
  }).sort({ expiresAt: 1, code: 1 });

  let usedByUser = new Map();
  if (userId && candidates.length) {
    const rows = await CouponRedemption.aggregate([
      { $match: { user: new mongoose.Types.ObjectId(userId), coupon: { $in: candidates.map((c) => c._id) } } },
      { $group: { _id: '$coupon', used: { $sum: 1 } } },
    ]);
    usedByUser = new Map(rows.map((r) => [r._id.toString(), r.used]));
  }

  return candidates
    .filter((c) => c.perUserLimit == null || (usedByUser.get(c.id) ?? 0) < c.perUserLimit)
    .map((c) => ({
      code: c.code,
      type: c.type,
      value: c.value,
      minOrderValue: c.minOrderValue,
      maxDiscount: c.maxDiscount,
      expiresAt: c.expiresAt,
      description: c.description ? { en: c.description.en, hi: c.description.hi } : null,
    }));
}
