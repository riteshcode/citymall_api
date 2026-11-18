import { describe, it, expect, beforeEach } from '@jest/globals';
import mongoose from 'mongoose';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { env } from '../src/config/env.js';
import { Order } from '../src/models/Order.js';
import { Category } from '../src/models/Category.js';
import { Banner } from '../src/models/Banner.js';
import { createAuthedUser, createCategory, createProduct, createAddress, placeOrder, istDate } from './helpers.js';

const app = createApp();
const base = env.apiBasePath;

describe('Admin — products / categories / banners lists (inactive included)', () => {
  let adminH;
  let customerH;
  let cat;

  beforeEach(async () => {
    const admin = await createAuthedUser({ role: 'admin' });
    const customer = await createAuthedUser();
    adminH = { Authorization: `Bearer ${admin.accessToken}` };
    customerH = { Authorization: `Bearer ${customer.accessToken}` };
    cat = await createCategory();
    await createProduct(cat, { title: { en: 'Amul Milk', hi: 'अमूल दूध' }, stock: 50, brand: 'Amul' });
    await createProduct(cat, { title: { en: 'Old Biscuit', hi: 'पुराना बिस्कुट' }, stock: 50, isActive: false });
    await createProduct(cat, { title: { en: 'Rare Spice', hi: 'मसाला' }, stock: 3, tags: ['masala'] });
  });

  it('lists inactive products too, with category name and pagination meta', async () => {
    const res = await request(app).get(`${base}/admin/products`).set(adminH);
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(3);
    expect(res.body.meta).toEqual({ total: 3, page: 1, limit: 20, pages: 1 });
    expect(res.body.data.some((p) => p.isActive === false)).toBe(true);
    expect(res.body.data[0].category.name.en).toBe('Test Category');

    // The public list must still hide the inactive one.
    const pub = await request(app).get(`${base}/products`);
    expect(pub.body.meta.total).toBe(2);
  });

  it('filters by isActive, lowStock and category; searches title/brand/tag as a substring', async () => {
    const inactive = await request(app).get(`${base}/admin/products?isActive=false`).set(adminH);
    expect(inactive.body.data.map((p) => p.title.en)).toEqual(['Old Biscuit']);

    const active = await request(app).get(`${base}/admin/products?isActive=true`).set(adminH);
    expect(active.body.meta.total).toBe(2);

    const low = await request(app).get(`${base}/admin/products?lowStock=true`).set(adminH);
    expect(low.body.data.map((p) => p.title.en)).toEqual(['Rare Spice']); // stock 3 <= threshold

    const bySubstring = await request(app).get(`${base}/admin/products?q=ilk`).set(adminH);
    expect(bySubstring.body.data.map((p) => p.title.en)).toEqual(['Amul Milk']);
    const byTag = await request(app).get(`${base}/admin/products?q=masal`).set(adminH);
    expect(byTag.body.data).toHaveLength(1);
    const byHindi = await request(app).get(`${base}/admin/products`).query({ q: 'दूध' }).set(adminH);
    expect(byHindi.body.data).toHaveLength(1);

    const other = await createCategory();
    const byCat = await request(app).get(`${base}/admin/products?category=${other.id}`).set(adminH);
    expect(byCat.body.data).toHaveLength(0);
  });

  it('a soft-deleted product can be found and re-activated', async () => {
    const [prod] = (await request(app).get(`${base}/admin/products?isActive=false`).set(adminH)).body.data;
    const patched = await request(app).patch(`${base}/admin/products/${prod.id}`).set(adminH).send({ isActive: true });
    expect(patched.status).toBe(200);
    expect((await request(app).get(`${base}/products`)).body.meta.total).toBe(3);
  });

  it('rejects bad params, unknown params, customers and anonymous callers', async () => {
    expect((await request(app).get(`${base}/admin/products?isActive=maybe`).set(adminH)).status).toBe(400);
    expect((await request(app).get(`${base}/admin/products?foo=1`).set(adminH)).status).toBe(400);
    expect((await request(app).get(`${base}/admin/products`).set(customerH)).status).toBe(403);
    expect((await request(app).get(`${base}/admin/products`)).status).toBe(401);
  });

  it('GET /admin/categories and /admin/banners include inactive rows; the public lists do not', async () => {
    await Category.create({ name: { en: 'Hidden', hi: 'छिपा' }, slug: 'hidden', isActive: false });
    await Banner.create({ title: { en: 'Off', hi: 'बंद' }, image: 'https://x.test/a.jpg', isActive: false });

    const cats = await request(app).get(`${base}/admin/categories`).set(adminH);
    expect(cats.body.data.map((c) => c.slug)).toContain('hidden');
    expect((await request(app).get(`${base}/categories`)).body.data.map((c) => c.slug)).not.toContain('hidden');

    const banners = await request(app).get(`${base}/admin/banners`).set(adminH);
    expect(banners.body.data).toHaveLength(1);
    expect((await request(app).get(`${base}/banners`)).body.data).toHaveLength(0);

    expect((await request(app).get(`${base}/admin/categories`).set(customerH)).status).toBe(403);
    expect((await request(app).get(`${base}/admin/banners`).set(customerH)).status).toBe(403);
  });
});

describe('Admin — orders filters and detail', () => {
  let adminH;
  let alice;
  let bob;
  let oldOrder;
  let newOrder;

  beforeEach(async () => {
    const admin = await createAuthedUser({ role: 'admin' });
    adminH = { Authorization: `Bearer ${admin.accessToken}` };
    alice = await createAuthedUser({ mobile: '9811111111' });
    bob = await createAuthedUser({ mobile: '9822222222' });
    const product = await createProduct(await createCategory(), { stock: 100 });
    const a = await createAddress(alice.user);
    const b = await createAddress(bob.user);
    oldOrder = (await placeOrder(app, base, alice, product, a._id.toString())).body.data;
    newOrder = (await placeOrder(app, base, bob, product, b._id.toString())).body.data;
    // createdAt is immutable through Mongoose, so backdate with the raw driver.
    await Order.collection.updateOne(
      { _id: new mongoose.Types.ObjectId(oldOrder.id) },
      { $set: { createdAt: new Date(Date.now() - 10 * 86400000) } }
    );
  });

  const list = (qs) => request(app).get(`${base}/admin/orders${qs}`).set(adminH);

  it('from/to filter by createdAt; a date-only "to" includes that whole day', async () => {
    const today = istDate(0);
    expect((await list(`?from=${today}`)).body.data.map((o) => o.id)).toEqual([newOrder.id]);
    expect((await list(`?to=${istDate(5)}`)).body.data.map((o) => o.id)).toEqual([oldOrder.id]);
    expect((await list(`?from=${today}&to=${today}`)).body.data.map((o) => o.id)).toEqual([newOrder.id]);
    expect((await list(`?from=${istDate(30)}&to=${today}`)).body.meta.total).toBe(2);
    expect((await list(`?from=${new Date(Date.now() - 60000).toISOString()}`)).body.data).toHaveLength(1);
  });

  it('rejects from > to, impossible dates and garbage', async () => {
    expect((await list(`?from=${istDate(0)}&to=${istDate(3)}`)).status).toBe(400);
    expect((await list('?from=2026-02-31')).status).toBe(400);
    expect((await list('?from=yesterday')).status).toBe(400);
  });

  it('q matches orderNumber OR customer mobile (substring)', async () => {
    const byMobile = await list('?q=811111');
    expect(byMobile.body.data.map((o) => o.id)).toEqual([oldOrder.id]);
    expect(byMobile.body.data[0].user).toMatchObject({ name: 'Test Customer', mobile: '9811111111' });
    expect(byMobile.body.data[0].user.id).toBeDefined();

    const byNumber = await list(`?q=${newOrder.orderNumber.slice(4, 14)}`);
    expect(byNumber.body.data.map((o) => o.id)).toEqual([newOrder.id]);

    expect((await list('?q=nomatch999')).body.data).toHaveLength(0);
    // regex metacharacters in q are treated literally, not as a pattern
    expect((await list('?q=.*')).status).toBe(200);
    expect((await list('?q=.*')).body.data).toHaveLength(0);
  });

  it('combines status + q + dates and keeps meta.total consistent', async () => {
    await request(app).patch(`${base}/admin/orders/${newOrder.id}/status`).set(adminH).send({ status: 'confirmed' });
    const res = await list(`?status=confirmed&q=822222&from=${istDate(0)}`);
    expect(res.body.data.map((o) => o.id)).toEqual([newOrder.id]);
    expect(res.body.meta).toMatchObject({ total: 1, page: 1, limit: 20, pages: 1 });
  });

  it('detail returns the full order plus the customer card', async () => {
    const res = await request(app).get(`${base}/admin/orders/${oldOrder.id}`).set(adminH);
    expect(res.status).toBe(200);
    expect(res.body.data.items).toHaveLength(1);
    expect(res.body.data.shippingAddress.pincode).toBe('110001');
    expect(res.body.data.user).toMatchObject({ name: 'Test Customer', mobile: '9811111111', isVerified: true });
    expect(res.body.data.user.createdAt).toBeDefined();
    expect(res.body.data.statusHistory.length).toBeGreaterThan(0);
    expect((await request(app).get(`${base}/admin/orders/507f1f77bcf86cd799439011`).set(adminH)).status).toBe(404);
  });
});

describe('Admin — stats and customers', () => {
  let adminH;
  let alice;

  beforeEach(async () => {
    const admin = await createAuthedUser({ role: 'admin' });
    adminH = { Authorization: `Bearer ${admin.accessToken}` };
    alice = await createAuthedUser({ mobile: '9833333333' });
    await createAuthedUser({ mobile: '9844444444' });
  });

  it('computes dashboard numbers (paise, IST "today", cancelled/old orders excluded where they should be)', async () => {
    const category = await createCategory();
    const product = await createProduct(category, { stock: 100, price: 8000 });
    await createProduct(category, { stock: 2 }); // low stock
    await createProduct(category, { stock: 0, isActive: false }); // inactive: must NOT count as low stock
    const addr = await createAddress(alice.user);
    const a = addr._id.toString();

    const todayOrder = (await placeOrder(app, base, alice, product, a)).body.data; // counts
    const cancelled = (await placeOrder(app, base, alice, product, a)).body.data;
    await request(app).post(`${base}/orders/${cancelled.id}/cancel`).set({ Authorization: `Bearer ${alice.accessToken}` }).send({});
    const old = (await placeOrder(app, base, alice, product, a)).body.data;
    await Order.collection.updateOne(
      { _id: new mongoose.Types.ObjectId(old.id) },
      { $set: { createdAt: new Date(Date.now() - 3 * 86400000) } }
    );
    await request(app).patch(`${base}/admin/orders/${old.id}/status`).set(adminH).send({ status: 'out_for_delivery' });

    const res = await request(app).get(`${base}/admin/stats`).set(adminH);
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({
      todayOrders: 1,
      todayRevenue: todayOrder.pricing.total,
      pendingOrders: 1, // todayOrder only: cancelled is closed, `old` is out_for_delivery
      outForDelivery: 1,
      lowStockCount: 1,
      totalCustomers: 2, // alice + the other customer; the admin is not a customer
    });
  });

  it('is all zeros on an empty store and admin-only', async () => {
    const res = await request(app).get(`${base}/admin/stats`).set(adminH);
    expect(res.body.data).toMatchObject({ todayOrders: 0, todayRevenue: 0, pendingOrders: 0, outForDelivery: 0, lowStockCount: 0 });
    const customer = await createAuthedUser();
    expect((await request(app).get(`${base}/admin/stats`).set({ Authorization: `Bearer ${customer.accessToken}` })).status).toBe(403);
  });

  it('lists customers only, newest first, with ordersCount; supports q on name/mobile', async () => {
    const product = await createProduct(await createCategory(), { stock: 100 });
    const addr = await createAddress(alice.user);
    await placeOrder(app, base, alice, product, addr._id.toString());
    await placeOrder(app, base, alice, product, addr._id.toString());

    const res = await request(app).get(`${base}/admin/users`).set(adminH);
    expect(res.status).toBe(200);
    expect(res.body.meta).toMatchObject({ total: 2, page: 1, limit: 20, pages: 1 });
    expect(res.body.data.map((u) => u.mobile)).not.toContain('9999999999');
    const row = res.body.data.find((u) => u.mobile === '9833333333');
    expect(row).toEqual({
      id: alice.user.id,
      name: 'Test Customer',
      mobile: '9833333333',
      email: null,
      isVerified: true,
      ordersCount: 2,
      createdAt: expect.any(String),
    });
    expect(res.body.data.find((u) => u.mobile === '9844444444').ordersCount).toBe(0);

    const q = await request(app).get(`${base}/admin/users?q=833333`).set(adminH);
    expect(q.body.data.map((u) => u.mobile)).toEqual(['9833333333']);

    const paged = await request(app).get(`${base}/admin/users?limit=1&page=2`).set(adminH);
    expect(paged.body.data).toHaveLength(1);
    expect(paged.body.meta).toMatchObject({ total: 2, pages: 2 });
  });
});
