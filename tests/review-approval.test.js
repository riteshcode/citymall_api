import { describe, it, expect, beforeEach } from '@jest/globals';
import request from 'supertest';
import mongoose from 'mongoose';
import { createApp } from '../src/app.js';
import { env } from '../src/config/env.js';
import { Review } from '../src/models/Review.js';
import { Product } from '../src/models/Product.js';
import { runMigrations } from '../src/migrations/index.js';
import { createAuthedUser, createCategory, createProduct, createAddress, placeOrder, adminSetStatus, bearer } from './helpers.js';

const app = createApp();
const base = env.apiBasePath;

describe('Review approval', () => {
  let admin;
  let adminH;
  let tea;
  let cat;

  beforeEach(async () => {
    admin = await createAuthedUser({ role: 'admin' });
    adminH = bearer(admin);
    cat = await createCategory();
    tea = await createProduct(cat, { slug: 'tea', title: { en: 'Tea', hi: 'चाय' } });
  });

  /** A customer who really bought and received `product`. */
  const buyer = async (product = tea, name = 'Customer') => {
    const who = await createAuthedUser({ name });
    const address = await createAddress(who.user);
    const order = (await placeOrder(app, base, who, product, address._id.toString())).body.data;
    await adminSetStatus(app, base, admin, order.id, 'delivered');
    return who;
  };
  const post = (who, rating = 5, comment = 'Nice', product = tea) =>
    request(app).post(`${base}/products/${product.id}/reviews`).set(bearer(who)).send({ rating, comment });
  const publicList = (product = tea) => request(app).get(`${base}/products/${product.id}/reviews`);
  const mine = (who, product = tea) => request(app).get(`${base}/products/${product.id}/reviews/mine`).set(bearer(who));
  const moderate = (id, body, h = adminH) => request(app).patch(`${base}/admin/reviews/${id}/status`).set(h).send(body);
  const adminList = (qs = '') => request(app).get(`${base}/admin/reviews${qs}`).set(adminH);
  const rating = async (product = tea) => {
    const p = await Product.findById(product.id).lean();
    return [p.ratingAvg, p.ratingCount];
  };

  // ------------------------------------------------------------------ submitting
  describe('POST /products/:id/reviews', () => {
    it('returns the review as "pending" and does not touch the product rating', async () => {
      const who = await buyer();
      const res = await post(who, 5, 'Lovely');
      expect(res.status).toBe(201);
      expect(res.body.data).toEqual({
        id: expect.stringMatching(/^[0-9a-f]{24}$/),
        user: who.user.id,
        product: tea.id,
        order: expect.any(String),
        rating: 5,
        comment: 'Lovely',
        status: 'pending',
        createdAt: expect.any(String),
        updatedAt: expect.any(String),
      });
      expect(await rating()).toEqual([0, 0]);
      expect((await Review.findById(res.body.data.id)).moderatedAt).toBeNull();
    });

    it('still one review per customer and product, whatever its status', async () => {
      const who = await buyer();
      const first = await post(who);
      expect((await post(who, 2)).body.error.code).toBe('REVIEW_ALREADY_EXISTS'); // pending
      await moderate(first.body.data.id, { status: 'rejected' });
      expect((await post(who, 2)).body.error.code).toBe('REVIEW_ALREADY_EXISTS'); // rejected
    });

    it('still needs a delivered order', async () => {
      const stranger = await createAuthedUser();
      expect((await post(stranger)).body.error.code).toBe('REVIEW_REQUIRES_DELIVERED_ORDER');
    });
  });

  // ------------------------------------------------------------------ storefront
  describe('what the storefront sees', () => {
    it('the public list shows APPROVED reviews only, without moderation internals', async () => {
      const [a, b, c] = [await buyer(tea, 'Asha'), await buyer(tea, 'Bina'), await buyer(tea, 'Chitra')];
      const ra = (await post(a, 5, 'approved one')).body.data;
      const rb = (await post(b, 1, 'rejected one')).body.data;
      await post(c, 3, 'still pending');
      await moderate(ra.id, { status: 'approved', note: 'ok' });
      await moderate(rb.id, { status: 'rejected', note: 'spam' });

      const res = await publicList();
      expect(res.status).toBe(200);
      expect(res.body.meta.total).toBe(1);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0]).toEqual(expect.objectContaining({ id: ra.id, comment: 'approved one', rating: 5, status: 'approved' }));
      expect(res.body.data[0].user).toEqual(expect.objectContaining({ name: 'Asha' }));
      expect(JSON.stringify(res.body)).not.toMatch(/moderationNote|moderatedAt|spam/);
    });

    it('ratingAvg / ratingCount count approved reviews only', async () => {
      const [a, b, c] = [await buyer(), await buyer(), await buyer()];
      const ids = [(await post(a, 5)).body.data.id, (await post(b, 2)).body.data.id, (await post(c, 4)).body.data.id];
      expect(await rating()).toEqual([0, 0]);

      await moderate(ids[0], { status: 'approved' });
      expect(await rating()).toEqual([5, 1]);
      await moderate(ids[1], { status: 'rejected' });
      expect(await rating()).toEqual([5, 1]);
      await moderate(ids[2], { status: 'approved' });
      expect(await rating()).toEqual([4.5, 2]);
    });

    it('GET /products/:id/reviews/mine: the caller\'s own review in ANY status, null when there is none, 401 without a token', async () => {
      const who = await buyer();
      const other = await buyer();
      expect((await mine(who)).body).toEqual({ success: true, data: null, error: null });

      const created = (await post(who, 4, 'mine')).body.data;
      const pending = await mine(who);
      expect(pending.status).toBe(200);
      expect(pending.body.data).toEqual(expect.objectContaining({ id: created.id, status: 'pending', rating: 4, comment: 'mine' }));
      expect((await mine(other)).body.data).toBeNull(); // nobody else's review leaks

      await moderate(created.id, { status: 'rejected', note: 'internal remark' });
      const rejected = await mine(who);
      expect(rejected.body.data.status).toBe('rejected');
      expect(JSON.stringify(rejected.body)).not.toMatch(/internal remark|moderationNote/); // the customer never sees the admin's note

      await moderate(created.id, { status: 'approved' });
      expect((await mine(who)).body.data.status).toBe('approved');

      expect((await request(app).get(`${base}/products/${tea.id}/reviews/mine`)).status).toBe(401);
      expect((await request(app).get(`${base}/products/nope/reviews/mine`).set(bearer(who))).status).toBe(400);
    });
  });

  // ------------------------------------------------------------------ admin list
  describe('GET /admin/reviews?status=', () => {
    let pendingR;
    let approvedR;
    let rejectedR;

    beforeEach(async () => {
      pendingR = (await post(await buyer(), 3, 'p')).body.data;
      approvedR = (await post(await buyer(), 5, 'a')).body.data;
      rejectedR = (await post(await buyer(), 1, 'r')).body.data;
      await moderate(approvedR.id, { status: 'approved' });
      await moderate(rejectedR.id, { status: 'rejected', note: 'abusive' });
    });

    it('defaults to every status, newest first', async () => {
      const res = await adminList();
      expect(res.body.data.map((r) => r.id)).toEqual([rejectedR.id, approvedR.id, pendingR.id]);
      expect(res.body.data.map((r) => r.status)).toEqual(['rejected', 'approved', 'pending']);
    });

    it('filters by pending / approved / rejected and combines with the older filters', async () => {
      for (const [status, expected] of [['pending', pendingR], ['approved', approvedR], ['rejected', rejectedR]]) {
        const res = await adminList(`?status=${status}`);
        expect([status, res.body.data.map((r) => r.id), res.body.meta.total]).toEqual([status, [expected.id], 1]);
      }
      expect((await adminList(`?status=approved&rating=1`)).body.data).toEqual([]);
      expect((await adminList(`?status=rejected&rating=1&productId=${tea.id}`)).body.meta.total).toBe(1);
    });

    it('shows the moderation fields; rejects an unknown status', async () => {
      const [rejected] = (await adminList('?status=rejected')).body.data;
      expect(rejected).toEqual(
        expect.objectContaining({ status: 'rejected', moderationNote: 'abusive', moderatedAt: expect.any(String), user: expect.objectContaining({ mobile: expect.any(String) }), product: expect.objectContaining({ slug: 'tea' }) })
      );
      const [pending] = (await adminList('?status=pending')).body.data;
      expect([pending.moderatedAt, pending.moderationNote]).toEqual([null, null]);
      expect((await adminList('?status=maybe')).status).toBe(400);
    });
  });

  // ------------------------------------------------------------------ moderating
  describe('PATCH /admin/reviews/:id/status', () => {
    it('approves: returns the review and the product\'s new { id, ratingAvg, ratingCount }', async () => {
      const r = (await post(await buyer(), 4, 'good')).body.data;
      const res = await moderate(r.id, { status: 'approved', note: 'Looks fine' });
      expect(res.status).toBe(200);
      expect(res.body.data.product).toEqual({ id: tea.id, ratingAvg: 4, ratingCount: 1 });
      expect(res.body.data.review).toEqual(
        expect.objectContaining({
          id: r.id,
          status: 'approved',
          rating: 4,
          comment: 'good',
          moderationNote: 'Looks fine',
          moderatedAt: expect.any(String),
          user: expect.objectContaining({ name: 'Customer' }),
          product: expect.objectContaining({ id: tea.id, slug: 'tea' }),
        })
      );
      expect(Object.keys(res.body.data).sort()).toEqual(['product', 'review']);
    });

    it('can change its mind in both directions; the rating follows', async () => {
      const [a, b] = [await buyer(), await buyer()];
      const ra = (await post(a, 5)).body.data;
      const rb = (await post(b, 1)).body.data;
      await moderate(ra.id, { status: 'approved' });
      await moderate(rb.id, { status: 'approved' });
      expect(await rating()).toEqual([3, 2]);

      const down = await moderate(rb.id, { status: 'rejected', note: 'fake' });
      expect(down.body.data.product).toEqual({ id: tea.id, ratingAvg: 5, ratingCount: 1 });
      expect((await publicList()).body.data.map((r) => r.id)).toEqual([ra.id]);

      const up = await moderate(rb.id, { status: 'approved' }); // back again, note replaced by "none"
      expect(up.body.data.product).toEqual({ id: tea.id, ratingAvg: 3, ratingCount: 2 });
      expect(up.body.data.review.moderationNote).toBeNull();

      const twice = await moderate(rb.id, { status: 'approved' }); // idempotent
      expect(twice.body.data.product).toEqual({ id: tea.id, ratingAvg: 3, ratingCount: 2 });
    });

    it('rejecting the only approved review resets the product to 0 / 0', async () => {
      const r = (await post(await buyer(), 5)).body.data;
      await moderate(r.id, { status: 'approved' });
      expect((await moderate(r.id, { status: 'rejected' })).body.data.product).toEqual({ id: tea.id, ratingAvg: 0, ratingCount: 0 });
    });

    it('validates: only approved / rejected, strict body, note 1-300 chars, valid id', async () => {
      const r = (await post(await buyer())).body.data;
      for (const [label, body] of [
        ['pending', { status: 'pending' }],
        ['unknown status', { status: 'spam' }],
        ['no status', {}],
        ['extra key', { status: 'approved', rating: 1 }],
        ['empty note', { status: 'approved', note: '' }],
        ['long note', { status: 'approved', note: 'x'.repeat(301) }],
      ]) {
        const res = await moderate(r.id, body);
        expect([label, res.status, res.body.error.code]).toEqual([label, 400, 'VALIDATION_ERROR']);
      }
      expect((await moderate('nope', { status: 'approved' })).status).toBe(400);
      expect((await moderate('507f1f77bcf86cd799439011', { status: 'approved' })).body.error.code).toBe('REVIEW_NOT_FOUND');
      expect((await Review.findById(r.id)).status).toBe('pending');
      expect((await moderate(r.id, { status: 'approved', note: 'x'.repeat(300) })).status).toBe(200);
    });

    it('is admin-only', async () => {
      const who = await buyer();
      const r = (await post(who)).body.data;
      expect((await moderate(r.id, { status: 'approved' }, bearer(who))).status).toBe(403);
      expect((await moderate(r.id, { status: 'approved' }, {})).status).toBe(401);
      expect((await Review.findById(r.id)).status).toBe('pending');
    });

    it('deleting a pending review leaves the rating alone; deleting an approved one recalculates it', async () => {
      const [a, b] = [await buyer(), await buyer()];
      const ra = (await post(a, 5)).body.data;
      const rb = (await post(b, 1)).body.data;
      await moderate(ra.id, { status: 'approved' });

      const delPending = await request(app).delete(`${base}/admin/reviews/${rb.id}`).set(adminH);
      expect(delPending.body.data.product).toEqual({ id: tea.id, ratingAvg: 5, ratingCount: 1 });
      const delApproved = await request(app).delete(`${base}/admin/reviews/${ra.id}`).set(adminH);
      expect(delApproved.body.data.product).toEqual({ id: tea.id, ratingAvg: 0, ratingCount: 0 });
    });
  });

  // ------------------------------------------------------------------ dashboard
  it('GET /admin/stats counts pendingReviews', async () => {
    expect((await request(app).get(`${base}/admin/stats`).set(adminH)).body.data.pendingReviews).toBe(0);
    const [a, b] = [await buyer(), await buyer()];
    const ra = (await post(a)).body.data;
    await post(b);
    expect((await request(app).get(`${base}/admin/stats`).set(adminH)).body.data.pendingReviews).toBe(2);
    await moderate(ra.id, { status: 'approved' });
    expect((await request(app).get(`${base}/admin/stats`).set(adminH)).body.data.pendingReviews).toBe(1);
  });

  // ------------------------------------------------------------------ migration
  describe('reviews that existed before moderation', () => {
    it('the migration marks them approved (so they stay public and counted) and leaves everything else alone; it is idempotent', async () => {
      const [old1, old2] = [await createAuthedUser(), await createAuthedUser()];
      // raw documents, exactly as the old code stored them: no status / moderatedAt / moderationNote
      const raw = (user, rating, comment) => ({
        _id: new mongoose.Types.ObjectId(),
        user: user.user._id,
        product: tea._id,
        order: new mongoose.Types.ObjectId(),
        rating,
        comment,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      const legacy = [raw(old1, 5, 'old five'), raw(old2, 3, 'old three')];
      await Review.collection.insertMany(legacy);
      const fresh = (await post(await buyer(), 1, 'new one')).body.data; // pending, must NOT be touched

      expect(await runMigrations()).toEqual({ reviewsApproved: 2 });
      expect((await Review.find({ _id: { $in: legacy.map((l) => l._id) } })).map((r) => r.status)).toEqual(['approved', 'approved']);
      expect((await Review.findById(fresh.id)).status).toBe('pending');

      expect((await publicList()).body.data.map((r) => r.comment).sort()).toEqual(['old five', 'old three']);
      expect(await runMigrations()).toEqual({ reviewsApproved: 0 });
    });
  });
});
