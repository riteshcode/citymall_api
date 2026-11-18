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

/**
 * Fee configuration used for totals. Callers pass the DB-backed store settings
 * (settings.service.js); the env-derived default keeps these helpers usable standalone.
 * @typedef {{ deliveryFee: number, freeDeliveryThreshold: number, handlingFee: number }} FeeSettings
 */
const envFeeDefaults = () => ({
  deliveryFee: env.pricing.deliveryFeePaise,
  freeDeliveryThreshold: env.pricing.freeDeliveryThresholdPaise,
  handlingFee: env.pricing.handlingFeePaise,
});

/**
 * @param {number} subtotal paise
 * @param {FeeSettings} [settings]
 * @param {number|null} [deliveryFeeOverride] per-pincode fee (paise) replacing settings.deliveryFee; the
 *   free-delivery threshold still applies on top of it.
 */
export function computeDeliveryFee(subtotal, settings = envFeeDefaults(), deliveryFeeOverride = null) {
  if (subtotal <= 0) return 0;
  if (subtotal >= settings.freeDeliveryThreshold) return 0;
  return deliveryFeeOverride ?? settings.deliveryFee;
}

export function computeHandlingFee(subtotal, settings = envFeeDefaults()) {
  if (subtotal <= 0) return 0;
  return settings.handlingFee;
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
 * @param {{
 *   lineItems: { price: number, qty: number }[],
 *   coupon?: object|null,
 *   settings?: FeeSettings,
 *   deliveryFeeOverride?: number|null
 * }} params
 */
export function buildPricing({ lineItems, coupon = null, settings = envFeeDefaults(), deliveryFeeOverride = null }) {
  const subtotal = computeSubtotal(lineItems);
  const discount = computeCouponDiscount(coupon, subtotal);
  const deliveryFee = computeDeliveryFee(subtotal, settings, deliveryFeeOverride);
  const handlingFee = computeHandlingFee(subtotal, settings);
  const total = clampNonNegative(subtotal - discount + deliveryFee + handlingFee);

  return { subtotal, discount, deliveryFee, handlingFee, total };
}
