import { clampNonNegative, percentOf } from '../utils/money.js';
import { env } from '../config/env.js';

/**
 * The ONLY place order/cart totals are computed. Both cart.service.js and
 * order.service.js call into this — never compute money math anywhere else.
 * Everything here works in integer paise.
 */

/** @param {{ price: number, qty: number }[]} lineItems */
export function computeSubtotal(lineItems) {
  return lineItems.reduce((sum, li) => sum + li.price * li.qty, 0);
}

export function computeDeliveryFee(subtotal) {
  if (subtotal <= 0) return 0;
  return subtotal >= env.pricing.freeDeliveryThresholdPaise ? 0 : env.pricing.deliveryFeePaise;
}

export function computeHandlingFee(subtotal) {
  if (subtotal <= 0) return 0;
  return env.pricing.handlingFeePaise;
}

/**
 * @param {object|null} coupon Mongoose Coupon doc (already validated as eligible)
 * @param {number} subtotal paise
 * @returns {number} discount in paise, never more than subtotal
 */
export function computeCouponDiscount(coupon, subtotal) {
  if (!coupon || subtotal <= 0) return 0;

  let discount = 0;
  if (coupon.type === 'flat') {
    discount = coupon.value;
  } else if (coupon.type === 'percent') {
    discount = percentOf(subtotal, coupon.value);
    if (coupon.maxDiscount != null) {
      discount = Math.min(discount, coupon.maxDiscount);
    }
  }

  return clampNonNegative(Math.min(discount, subtotal));
}

/**
 * Builds the full pricing breakdown for a set of resolved line items.
 * @param {{ lineItems: { price: number, qty: number }[], coupon?: object|null }} params
 */
export function buildPricing({ lineItems, coupon = null }) {
  const subtotal = computeSubtotal(lineItems);
  const discount = computeCouponDiscount(coupon, subtotal);
  const deliveryFee = computeDeliveryFee(subtotal);
  const handlingFee = computeHandlingFee(subtotal);
  const total = clampNonNegative(subtotal - discount + deliveryFee + handlingFee);

  return { subtotal, discount, deliveryFee, handlingFee, total };
}
