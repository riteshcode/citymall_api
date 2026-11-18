import { describe, it, expect } from '@jest/globals';
import {
  computeSubtotal,
  computeDeliveryFee,
  computeHandlingFee,
  computeCouponDiscount,
  buildPricing,
} from '../src/services/pricing.service.js';
import { env } from '../src/config/env.js';

describe('pricing.service — cart math (all paise, integers)', () => {
  it('computes subtotal as sum of price * qty', () => {
    const subtotal = computeSubtotal([
      { price: 2500, qty: 2 },
      { price: 1000, qty: 3 },
    ]);
    expect(subtotal).toBe(2500 * 2 + 1000 * 3);
  });

  it('charges delivery fee below the free-delivery threshold', () => {
    const subtotal = env.pricing.freeDeliveryThresholdPaise - 100;
    expect(computeDeliveryFee(subtotal)).toBe(env.pricing.deliveryFeePaise);
  });

  it('waives delivery fee at/above the free-delivery threshold', () => {
    expect(computeDeliveryFee(env.pricing.freeDeliveryThresholdPaise)).toBe(0);
    expect(computeDeliveryFee(env.pricing.freeDeliveryThresholdPaise + 500)).toBe(0);
  });

  it('charges no fees on an empty cart', () => {
    expect(computeDeliveryFee(0)).toBe(0);
    expect(computeHandlingFee(0)).toBe(0);
  });

  it('applies a flat coupon discount, capped at the subtotal', () => {
    const coupon = { type: 'flat', value: 5000, maxDiscount: null };
    expect(computeCouponDiscount(coupon, 10000)).toBe(5000);
    expect(computeCouponDiscount(coupon, 3000)).toBe(3000); // never exceeds subtotal
  });

  it('applies a percent coupon discount and honours maxDiscount cap', () => {
    const coupon = { type: 'percent', value: 10, maxDiscount: 200 };
    expect(computeCouponDiscount(coupon, 10000)).toBe(200); // 10% of 10000 = 1000, capped at 200
    const uncapped = { type: 'percent', value: 10, maxDiscount: null };
    expect(computeCouponDiscount(uncapped, 10000)).toBe(1000);
  });

  it('returns 0 discount when no coupon is applied', () => {
    expect(computeCouponDiscount(null, 10000)).toBe(0);
  });

  it('builds a full pricing breakdown consistently', () => {
    const lineItems = [{ price: 25000, qty: 1 }]; // above free delivery threshold
    const pricing = buildPricing({ lineItems, coupon: null });

    expect(pricing.subtotal).toBe(25000);
    expect(pricing.deliveryFee).toBe(0);
    expect(pricing.handlingFee).toBe(env.pricing.handlingFeePaise);
    expect(pricing.total).toBe(pricing.subtotal - pricing.discount + pricing.deliveryFee + pricing.handlingFee);
  });

  it('never lets total go negative even with a large discount', () => {
    const lineItems = [{ price: 1000, qty: 1 }];
    const coupon = { type: 'flat', value: 999999, maxDiscount: null };
    const pricing = buildPricing({ lineItems, coupon });
    expect(pricing.total).toBeGreaterThanOrEqual(0);
    expect(pricing.discount).toBeLessThanOrEqual(pricing.subtotal);
  });
});

describe('pricing.service — DB-backed settings and per-pincode fee override', () => {
  const settings = { deliveryFee: 4000, freeDeliveryThreshold: 10000, handlingFee: 100 };

  it('uses the passed settings instead of env', () => {
    expect(computeDeliveryFee(9999, settings)).toBe(4000);
    expect(computeDeliveryFee(10000, settings)).toBe(0);
    expect(computeHandlingFee(500, settings)).toBe(100);
  });

  it('a pincode override replaces the base delivery fee but the free threshold still wins', () => {
    expect(computeDeliveryFee(5000, settings, 1500)).toBe(1500);
    expect(computeDeliveryFee(5000, settings, 0)).toBe(0); // an explicit ₹0 override is honoured (not treated as "unset")
    expect(computeDeliveryFee(10000, settings, 1500)).toBe(0);
    expect(computeDeliveryFee(5000, settings, null)).toBe(4000);
  });

  it('threshold 0 means delivery is always free; empty cart still costs nothing', () => {
    expect(computeDeliveryFee(1, { ...settings, freeDeliveryThreshold: 0 })).toBe(0);
    expect(computeDeliveryFee(0, settings, 1500)).toBe(0);
  });

  it('buildPricing threads settings + override through to the total', () => {
    const p = buildPricing({ lineItems: [{ price: 5000, qty: 1 }], settings, deliveryFeeOverride: 1500 });
    expect(p).toEqual({ subtotal: 5000, discount: 0, deliveryFee: 1500, handlingFee: 100, total: 6600 });
  });
});
