import { describe, it, expect, beforeEach } from '@jest/globals';
import mongoose from 'mongoose';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { env } from '../src/config/env.js';
import { Review } from '../src/models/Review.js';
import { Product } from '../src/models/Product.js';
import { createAuthedUser, createCategory, createProduct, createAddress, placeOrder, adminSetStatus, bearer } from './helpers.js';

const app = createApp();
const base = env.apiBasePath;

describe('Admin — reviews moderation', () => {
  let admin;
  let adminH;
  let alice;
  let bob;
  let carol;
  let tea;
  let biscuits;
  let rAlice; // 5 stars on tea
  let rBob; // 1 star on tea
  let rCarol; // 4 stars on biscuits

  const review = (user, product, rating, comment = '') =>
    Review.create({ user: user.user._id, product: product._id, order: new mongoose.Types.ObjectId(), rating, comment, status: 'approved' });
  const recompute = async (product) => {
    const [agg] = await Review.aggregate([{ $match: { product: product._id, status: 'approved' } }, { $group: { _id: null, avg: { $avg: '$rating' }, n: { $sum: 1 } } }]);
    await Product.updateOne({ _id: product._id }, { ratingAvg: agg ? Math.round(agg.avg * 10) / 10 : 0, ratingCount: agg ? agg.n : 0 });
  };

  beforeEach(async () => {
    admin = await createAuthedUser({ role: 'admin' });
    adminH = bearer(admin);
    alice = await createAuthedUser({ mobile: '9866600001', name: 'Alice' });
    bob = await createAuthedUser({ mobile: '9866600002', name: 'Bob' });
    carol = await createAuthedUser({ mobile: '9866600003', name: 'Carol' });
    const cat = await createCategory();
    tea = await createProduct(cat, { slug: 'tea', title: { en: 'Tea', hi: 'चाय' } });
    biscuits = await createProduct(cat, { slug: 'biscuits', title: { en: 'Biscuits', hi: 'बिस्कुट' } });
    rAlice = await review(alice, tea, 5, 'Great tea');
    rBob = await review(bob, tea, 1, 'Stale and overpriced, visit my-spam-site.example');
    rCarol = await review(carol, biscuits, 4, 'Crunchy');
    await recompute(tea);
    await recompute(biscuits);
  });

  const list = (qs = '', h = adminH) => request(app).get(`${base}/admin/reviews${qs}`).set(h);
  const del = (id, h = adminH) => request(app).delete(`${base}/admin/reviews/${id}`).set(h);

  describe('GET /admin/reviews', () => {
    it('lists every review newest first with the author { name, mobile } and the product { title, slug }', async () => {
      const res = await list();
      expect(res.status).toBe(200);
      expect(res.body.data.map((r) => r.id)).toEqual([rCarol.id, rBob.id, rAlice.id]);
      expect(res.body.meta).toEqual({ total: 3, page: 1, limit: 20, pages: 1 });

      const bobRow = res.body.data.find((r) => r.id === rBob.id);
      expect(bobRow).toMatchObject({
        rating: 1,
        comment: 'Stale and overpriced, visit my-spam-site.example',
        user: { id: bob.user.id, name: 'Bob', mobile: '9866600002' },
        product: { id: tea.id, title: { en: 'Tea', hi: 'चाय' }, slug: 'tea' },
      });
      expect(bobRow.createdAt).toBeDefined();
    });

    it('filters by productId and rating, and paginates', async () => {
      expect((await list(`?productId=${tea.id}`)).body.data.map((r) => r.id)).toEqual([rBob.id, rAlice.id]);
      expect((await list(`?productId=${biscuits.id}`)).body.data.map((r) => r.id)).toEqual([rCarol.id]);
      expect((await list('?rating=1')).body.data.map((r) => r.id)).toEqual([rBob.id]);
      expect((await list(`?productId=${tea.id}&rating=5`)).body.data.map((r) => r.id)).toEqual([rAlice.id]);
      expect((await list('?rating=3')).body.data).toEqual([]);

      const page2 = await list('?limit=2&page=2');
      expect(page2.body.data.map((r) => r.id)).toEqual([rAlice.id]);
      expect(page2.body.meta).toEqual({ total: 3, page: 2, limit: 2, pages: 2 });
    });

    it('rejects bad filters and unknown params; admin-only', async () => {
      for (const qs of ['?rating=0', '?rating=6', '?rating=abc', '?rating=2.5', '?productId=nope', '?foo=1', '?limit=0']) {
        expect([qs, (await list(qs)).status]).toEqual([qs, 400]);
      }
      expect((await list('', bearer(alice))).status).toBe(403);
      expect((await list('', {})).status).toBe(401);
    });
  });

  describe('DELETE /admin/reviews/:id', () => {
    it('removes the review and recalculates the product\'s ratingAvg / ratingCount', async () => {
      expect(await Product.findById(tea.id).lean()).toMatchObject({ ratingAvg: 3, ratingCount: 2 }); // (5 + 1) / 2

      const res = await del(rBob.id);
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ success: true, data: { id: rBob.id, product: { id: tea.id, ratingAvg: 5, ratingCount: 1 } }, error: null });
      expect(await Product.findById(tea.id).lean()).toMatchObject({ ratingAvg: 5, ratingCount: 1 });
      expect(await Review.findById(rBob.id)).toBeNull();
      expect((await list()).body.meta.total).toBe(2);

      // other products are untouched
      expect(await Product.findById(biscuits.id).lean()).toMatchObject({ ratingAvg: 4, ratingCount: 1 });
    });

    it('deleting the last review resets the product to 0 / 0', async () => {
      const res = await del(rCarol.id);
      expect(res.body.data.product).toEqual({ id: biscuits.id, ratingAvg: 0, ratingCount: 0 });
      expect(await Product.findById(biscuits.id).lean()).toMatchObject({ ratingAvg: 0, ratingCount: 0 });
    });

    it('rounds the new average to one decimal like the review flow does', async () => {
      const dave = await createAuthedUser({ mobile: '9866600004' });
      await review(dave, tea, 4);
      await recompute(tea); // 5, 1, 4 -> 3.3
      expect((await Product.findById(tea.id)).ratingAvg).toBe(3.3);
      const res = await del(rBob.id); // 5, 4 -> 4.5
      expect(res.body.data.product).toMatchObject({ ratingAvg: 4.5, ratingCount: 2 });
    });

    it('404 REVIEW_NOT_FOUND when it is gone (a second delete is not an error that changes anything), 400 for bad ids', async () => {
      await del(rBob.id);
      const again = await del(rBob.id);
      expect([again.status, again.body.error.code]).toEqual([404, 'REVIEW_NOT_FOUND']);
      expect((await del('507f1f77bcf86cd799439011')).status).toBe(404);
      expect((await del('nope')).status).toBe(400);
      expect(await Product.findById(tea.id).lean()).toMatchObject({ ratingAvg: 5, ratingCount: 1 });
    });

    it('frees the author to review again; the public list no longer shows it', async () => {
      // a real flow: Bob buys tea, it is delivered, he reviews it, the admin removes the review, he reviews again
      const addressId = (await createAddress(bob.user))._id.toString();
      await Review.deleteOne({ _id: rBob.id });
      const order = (await placeOrder(app, base, bob, tea, addressId)).body.data;
      await adminSetStatus(app, base, admin, order.id, 'delivered');
      const first = await request(app).post(`${base}/products/${tea.id}/reviews`).set(bearer(bob)).send({ rating: 1, comment: 'spam' });
      expect(first.status).toBe(201);
      expect((await request(app).post(`${base}/products/${tea.id}/reviews`).set(bearer(bob)).send({ rating: 2 })).body.error.code).toBe('REVIEW_ALREADY_EXISTS');

      await del(first.body.data.id);
      expect((await request(app).get(`${base}/products/${tea.id}/reviews`)).body.data.map((r) => r.comment)).toEqual(['Great tea']);
      const second = await request(app).post(`${base}/products/${tea.id}/reviews`).set(bearer(bob)).send({ rating: 4, comment: 'better' });
      expect(second.status).toBe(201);
      expect((await Product.findById(tea.id)).ratingCount).toBe(1); // the new review is pending: not counted until approved
    });

    it('is admin-only', async () => {
      expect((await del(rBob.id, bearer(bob))).status).toBe(403); // not even the author
      expect((await del(rBob.id, {})).status).toBe(401);
      expect(await Review.findById(rBob.id)).not.toBeNull();
    });
  });
});
