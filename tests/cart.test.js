import { describe, it, expect, beforeEach } from '@jest/globals';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { env } from '../src/config/env.js';
import { Coupon } from '../src/models/Coupon.js';
import { createAuthedUser, createCategory, createProduct } from './helpers.js';

const app = createApp();
const base = env.apiBasePath;

describe('Cart — items and coupon edge cases', () => {
  let token;
  let product;

  beforeEach(async () => {
    const { accessToken } = await createAuthedUser();
    token = accessToken;
    const category = await createCategory();
    product = await createProduct(category, { price: 10000, mrp: 12000, stock: 5 });
  });

  const auth = () => ({ Authorization: `Bearer ${token}` });

  it('adds an item and returns a full pricing breakdown', async () => {
    const res = await request(app).post(`${base}/cart/items`).set(auth()).send({ productId: product.id, qty: 2 });

    expect(res.status).toBe(201);
    expect(res.body.data.items).toHaveLength(1);
    expect(res.body.data.items[0].qty).toBe(2);
    expect(res.body.data.pricing.subtotal).toBe(20000);
    expect(res.body.data.pricing.total).toBe(
      res.body.data.pricing.subtotal - res.body.data.pricing.discount + res.body.data.pricing.deliveryFee + res.body.data.pricing.handlingFee
    );
  });

  it('setting qty to 0 removes the item', async () => {
    await request(app).post(`${base}/cart/items`).set(auth()).send({ productId: product.id, qty: 1 });
    const res = await request(app).patch(`${base}/cart/items/${product.id}`).set(auth()).send({ qty: 0 });

    expect(res.status).toBe(200);
    expect(res.body.data.items).toHaveLength(0);
  });

  it('never trusts a client-supplied price — server always recomputes from the live product', async () => {
    const res = await request(app)
      .post(`${base}/cart/items`)
      .set(auth())
      .send({ productId: product.id, qty: 1, price: 1 }); // extra field should be rejected

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  describe('coupon application', () => {
    beforeEach(async () => {
      await request(app).post(`${base}/cart/items`).set(auth()).send({ productId: product.id, qty: 1 }); // subtotal = 10000
    });

    it('returns COUPON_NOT_FOUND for an unknown code', async () => {
      const res = await request(app).post(`${base}/cart/coupon`).set(auth()).send({ code: 'NOPE123' });
      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('COUPON_NOT_FOUND');
    });

    it('returns COUPON_MIN_ORDER when subtotal is below minOrderValue', async () => {
      await Coupon.create({
        code: 'BIGORDER',
        type: 'flat',
        value: 1000,
        minOrderValue: 50000,
        startsAt: new Date(Date.now() - 86400000),
        expiresAt: new Date(Date.now() + 86400000),
        perUserLimit: 1,
      });

      const res = await request(app).post(`${base}/cart/coupon`).set(auth()).send({ code: 'BIGORDER' });
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('COUPON_MIN_ORDER');
    });

    it('returns COUPON_EXPIRED for a lapsed coupon', async () => {
      await Coupon.create({
        code: 'OLDONE',
        type: 'flat',
        value: 1000,
        minOrderValue: 0,
        startsAt: new Date(Date.now() - 20 * 86400000),
        expiresAt: new Date(Date.now() - 86400000),
        perUserLimit: 1,
      });

      const res = await request(app).post(`${base}/cart/coupon`).set(auth()).send({ code: 'OLDONE' });
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('COUPON_EXPIRED');
    });

    it('returns COUPON_USAGE_LIMIT_REACHED once the global usage cap is hit', async () => {
      await Coupon.create({
        code: 'CAPPED',
        type: 'flat',
        value: 1000,
        minOrderValue: 0,
        startsAt: new Date(Date.now() - 86400000),
        expiresAt: new Date(Date.now() + 86400000),
        usageLimit: 1,
        usedCount: 1,
        perUserLimit: 5,
      });

      const res = await request(app).post(`${base}/cart/coupon`).set(auth()).send({ code: 'CAPPED' });
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('COUPON_USAGE_LIMIT_REACHED');
    });

    it('applies a valid flat coupon and reflects the discount in pricing', async () => {
      await Coupon.create({
        code: 'FLAT20',
        type: 'flat',
        value: 2000,
        minOrderValue: 0,
        startsAt: new Date(Date.now() - 86400000),
        expiresAt: new Date(Date.now() + 86400000),
        perUserLimit: 1,
      });

      const res = await request(app).post(`${base}/cart/coupon`).set(auth()).send({ code: 'FLAT20' });
      expect(res.status).toBe(200);
      expect(res.body.data.couponCode).toBe('FLAT20');
      expect(res.body.data.pricing.discount).toBe(2000);
    });

    it('removing a coupon that is not applied returns NO_COUPON_APPLIED', async () => {
      const res = await request(app).delete(`${base}/cart/coupon`).set(auth());
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('NO_COUPON_APPLIED');
    });
  });
});
