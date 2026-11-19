import { describe, it, expect, beforeEach } from '@jest/globals';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { env } from '../src/config/env.js';
import { Coupon } from '../src/models/Coupon.js';
import { CouponRedemption } from '../src/models/CouponRedemption.js';
import { createAuthedUser, createCategory, createProduct, createAddress, bearer } from './helpers.js';

const app = createApp();
const base = env.apiBasePath;
const DAY = 24 * 3600 * 1000;

describe('Offers', () => {
  let adminH;
  beforeEach(async () => {
    adminH = bearer(await createAuthedUser({ role: 'admin' }));
  });

  const coupon = (over = {}) =>
    Coupon.create({
      code: `C${Math.random().toString(36).slice(2, 8).toUpperCase()}`,
      type: 'flat',
      value: 5000,
      minOrderValue: 19900,
      startsAt: new Date(Date.now() - DAY),
      expiresAt: new Date(Date.now() + 10 * DAY),
      perUserLimit: 1,
      isActive: true,
      ...over,
    });
  const available = (headers = {}, query = {}) => request(app).get(`${base}/coupons/available`).query(query).set(headers);

  describe('Coupon.description (admin)', () => {
    const body = {
      code: 'WELCOME50',
      type: 'flat',
      value: 5000,
      minOrderValue: 19900,
      startsAt: new Date(Date.now() - DAY).toISOString(),
      expiresAt: new Date(Date.now() + 30 * DAY).toISOString(),
    };

    it('is optional on create (null when missing), accepted and returned as { en, hi }', async () => {
      const plain = await request(app).post(`${base}/admin/coupons`).set(adminH).send(body);
      expect(plain.status).toBe(201);
      expect(plain.body.data.description ?? null).toBeNull();

      const described = await request(app)
        .post(`${base}/admin/coupons`)
        .set(adminH)
        .send({ ...body, code: 'WELCOME60', description: { en: 'Flat 50 off on orders above 199', hi: '199 से ऊपर के ऑर्डर पर 50 की छूट' } });
      expect(described.status).toBe(201);
      expect(described.body.data.description).toEqual({ en: 'Flat 50 off on orders above 199', hi: '199 से ऊपर के ऑर्डर पर 50 की छूट' });
    });

    it('PATCH sets, replaces and (with null) removes it; both languages are required when it is given', async () => {
      const id = (await request(app).post(`${base}/admin/coupons`).set(adminH).send(body)).body.data.id;
      const patch = (b) => request(app).patch(`${base}/admin/coupons/${id}`).set(adminH).send(b);

      expect((await patch({ description: { en: 'Hello', hi: 'नमस्ते' } })).body.data.description).toEqual({ en: 'Hello', hi: 'नमस्ते' });
      expect((await patch({ description: { en: 'Changed', hi: 'बदला' } })).body.data.description).toEqual({ en: 'Changed', hi: 'बदला' });
      expect((await patch({ description: null })).body.data.description ?? null).toBeNull();
      expect((await patch({ description: { en: 'Only English' } })).status).toBe(400);
      expect((await patch({ description: { en: '', hi: 'x' } })).status).toBe(400);
      expect((await patch({ description: { en: 'x'.repeat(201), hi: 'y' } })).status).toBe(400);
    });
  });

  describe('GET /coupons/available', () => {
    it('is public and lists [{ code, type, value, minOrderValue, maxDiscount, expiresAt, description }] soonest-expiring first', async () => {
      await coupon({ code: 'LATER', expiresAt: new Date(Date.now() + 20 * DAY), type: 'percent', value: 10, maxDiscount: 10000, minOrderValue: 0 });
      await coupon({ code: 'SOON', expiresAt: new Date(Date.now() + 2 * DAY), description: { en: 'Flat 50 off', hi: '50 की छूट' } });

      const res = await available();
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toEqual([
        { code: 'SOON', type: 'flat', value: 5000, minOrderValue: 19900, maxDiscount: null, expiresAt: expect.any(String), description: { en: 'Flat 50 off', hi: '50 की छूट' } },
        { code: 'LATER', type: 'percent', value: 10, minOrderValue: 0, maxDiscount: 10000, expiresAt: expect.any(String), description: null },
      ]);
      expect(JSON.stringify(res.body)).not.toMatch(/usedCount|usageLimit|perUserLimit|isActive|startsAt|"id"/); // no internals
      expect(res.body.meta).toBeUndefined();
    });

    it('leaves out inactive, not-yet-started, expired, used-up and zero-per-user coupons', async () => {
      await coupon({ code: 'GOOD' });
      await coupon({ code: 'OFF', isActive: false });
      await coupon({ code: 'FUTURE', startsAt: new Date(Date.now() + DAY), expiresAt: new Date(Date.now() + 5 * DAY) });
      await coupon({ code: 'EXPIRED', startsAt: new Date(Date.now() - 5 * DAY), expiresAt: new Date(Date.now() - DAY) });
      await coupon({ code: 'USEDUP', usageLimit: 10, usedCount: 10 });
      await coupon({ code: 'ZEROLIMIT', usageLimit: 0 });
      await coupon({ code: 'NOUSER', perUserLimit: 0 });
      await coupon({ code: 'ALMOST', usageLimit: 10, usedCount: 9 });
      await coupon({ code: 'UNLIMITED', usageLimit: null, perUserLimit: null });

      expect((await available()).body.data.map((c) => c.code).sort()).toEqual(['ALMOST', 'GOOD', 'UNLIMITED']);
    });

    it('with a token, coupons whose per-user limit this user has used up are removed (others still see them)', async () => {
      const used = await coupon({ code: 'ONCE', perUserLimit: 1 });
      await coupon({ code: 'TWICE', perUserLimit: 2 });
      await coupon({ code: 'FRESH', perUserLimit: 1 });
      const me = await createAuthedUser();
      const other = await createAuthedUser();
      const redeem = (c, user) => CouponRedemption.create({ coupon: c._id, code: c.code, user: user.user._id, order: user.user._id });
      await redeem(used, me);
      await redeem(await Coupon.findOne({ code: 'TWICE' }), me); // 1 of 2: still available
      await redeem(used, other); // somebody else's use does not matter for me

      expect((await available(bearer(me))).body.data.map((c) => c.code).sort()).toEqual(['FRESH', 'TWICE']);
      expect((await available(bearer(other))).body.data.map((c) => c.code).sort()).toEqual(['FRESH', 'TWICE']);
      expect((await available()).body.data.map((c) => c.code).sort()).toEqual(['FRESH', 'ONCE', 'TWICE']); // anonymous: nothing to subtract
      const twiceMore = await Coupon.findOne({ code: 'TWICE' });
      await redeem(twiceMore, me);
      expect((await available(bearer(me))).body.data.map((c) => c.code)).toEqual(['FRESH']);
    });

    it('reacts to a real order: after using the coupon it disappears for that customer, and returns after the order is cancelled', async () => {
      await coupon({ code: 'AALI50', perUserLimit: 1 });
      const customer = await createAuthedUser();
      const address = await createAddress(customer.user);
      const product = await createProduct(await createCategory(), { price: 25000, mrp: 30000 });
      const h = bearer(customer);

      await request(app).post(`${base}/cart/items`).set(h).send({ productId: product.id, qty: 1 });
      await request(app).post(`${base}/cart/coupon`).set(h).send({ code: 'AALI50' });
      const order = await request(app).post(`${base}/orders`).set(h).set('Idempotency-Key', 'offers-1').send({ addressId: address._id.toString(), paymentMethod: 'cod' });
      expect(order.status).toBe(201);
      expect((await available(h)).body.data).toEqual([]);

      await request(app).post(`${base}/orders/${order.body.data.id}/cancel`).set(h).send({});
      expect((await available(h)).body.data.map((c) => c.code)).toEqual(['AALI50']); // the cancelled order gave the coupon back
    });

    it('an invalid or expired token is 401 (the app can refresh it), not silently a guest; no params allowed', async () => {
      await coupon({ code: 'GOOD' });
      const bad = await available({ Authorization: 'Bearer not.a.token' });
      expect([bad.status, bad.body.error.code]).toEqual([401, 'TOKEN_INVALID']);
      expect((await available({}, { page: 2 })).status).toBe(400);
      expect((await available({ Authorization: 'Basic abc' })).status).toBe(401);
    });

    it('is an empty list (not an error) when there are no offers', async () => {
      const res = await available();
      expect([res.status, res.body.data]).toEqual([200, []]);
    });
  });
});
