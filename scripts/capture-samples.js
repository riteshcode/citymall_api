// Boots the API against an in-memory Mongo replica set, runs a realistic
// customer + admin flow, and writes every real response to docs/SAMPLE_RESPONSES.md.
// Usage: npm run samples
process.env.NODE_ENV = 'test'; // silences logger/morgan; must be set before importing src/*

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import mongoose from 'mongoose';
import request from 'supertest';
import { MongoMemoryReplSet } from 'mongodb-memory-server';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { createApp } = await import('../src/app.js');
const { env } = await import('../src/config/env.js');
const { Category } = await import('../src/models/Category.js');
const { Product } = await import('../src/models/Product.js');
const { Coupon } = await import('../src/models/Coupon.js');
const { User } = await import('../src/models/User.js');
const { Pincode } = await import('../src/models/Pincode.js');
const { categories, productRows } = await import('../src/seed/data.js');

const base = env.apiBasePath;
const samples = [];
const MAX_ARRAY = 2;

function trimForDisplay(body) {
  if (body && Array.isArray(body.data) && body.data.length > MAX_ARRAY) {
    return { body: { ...body, data: body.data.slice(0, MAX_ARRAY) }, note: `data has ${body.data.length} items, showing first ${MAX_ARRAY}` };
  }
  return { body, note: null };
}

async function call(title, req) {
  const res = await req;
  const { body, note } = trimForDisplay(res.body);
  samples.push({
    title,
    method: res.request.method,
    url: res.request.url.replace(/^http:\/\/127\.0\.0\.1:\d+/, ''),
    status: res.status,
    body,
    note,
  });
  return res;
}

const rs = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
await mongoose.connect(rs.getUri(), { dbName: 'aali_samples' });

// ---- seed (same fixtures as `npm run seed`) ----
const catBySlug = new Map();
for (const c of categories) catBySlug.set(c.slug, await Category.create({ ...c, isActive: true }));
for (const [cs, en, hi, brand, unit, mrp, price, stock, tags] of productRows) {
  const slug = en.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
  await Product.create({
    slug, title: { en, hi },
    description: { en: `${en} — ${unit}, sourced fresh for Aali Market customers.`, hi: `${hi} — ${unit}, आली मार्केट के ग्राहकों के लिए ताज़ा उपलब्ध।` },
    category: catBySlug.get(cs)._id, brand, images: [], mrp, price, unit, stock, tags, isActive: true,
  });
}
const now = new Date();
await Coupon.create({ code: 'AALI50', type: 'flat', value: 5000, minOrderValue: 19900, maxDiscount: null, startsAt: now, expiresAt: new Date(now.getFullYear() + 1, now.getMonth(), now.getDate()), usageLimit: 10000, perUserLimit: 1, isActive: true });
await User.create({ mobile: env.seed.adminMobile, name: env.seed.adminName, email: env.seed.adminEmail, role: 'admin', isVerified: true });

await Pincode.create([
  { pincode: '261001', areaName: { en: 'Sitapur', hi: 'सीतापुर' }, etaDays: 1 },
  { pincode: '226001', areaName: { en: 'Lucknow - Hazratganj', hi: 'लखनऊ - हज़रतगंज' }, etaDays: 2 },
  { pincode: '110001', areaName: { en: 'New Delhi - Connaught Place', hi: 'नई दिल्ली - कनॉट प्लेस' }, etaDays: 2, deliveryFee: 3500 },
]);

const app = createApp();
const api = (m, p) => request(app)[m](`${base}${p}`);

async function login(mobile, name) {
  const sent = await api('post', '/auth/otp/send').send({ mobile, purpose: 'login' });
  const verify = await api('post', '/auth/otp/verify').send({ mobile, code: sent.body.data.code, purpose: 'login', name });
  return { sent, verify, token: verify.body.data.accessToken };
}
const bearer = (t) => ({ Authorization: `Bearer ${t}` });

// ---- admin login (not shown as a sample; same endpoints as customer) ----
const admin = await login(env.seed.adminMobile);
const A = bearer(admin.token);

// ---- customer: OTP ----
const sent = await call('POST /auth/otp/send', api('post', '/auth/otp/send').send({ mobile: '9876543210', purpose: 'login' }));
const verify = await call('POST /auth/otp/verify (new user)', api('post', '/auth/otp/verify').send({ mobile: '9876543210', code: sent.body.data.code, purpose: 'login', name: 'Ritesh' }));
const C = bearer(verify.body.data.accessToken);

await call('GET /me', api('get', '/me').set(C));

// ---- catalog ----
await call('GET /categories', api('get', '/categories'));
const bannerRes = await api('post', '/admin/banners').set(A).send({ title: { en: 'Monsoon Sale', hi: 'मानसून सेल' }, image: 'https://example.com/banner.jpg', link: '/category/grocery-staples', sortOrder: 1, isActive: true });
await call('GET /banners', api('get', '/banners'));
const list = await call('GET /products?limit=2&sort=discount', api('get', '/products').query({ limit: 2, sort: 'discount' }));
await call('GET /products?q=atta (search)', api('get', '/products').query({ q: 'atta' }));
const atta = (await Product.findOne({ slug: 'aata-whole-wheat-flour' }));
const water = await Product.findOne({ slug: 'mineral-water' });
await call('GET /products/:slug', api('get', `/products/${atta.slug}`));

await call('GET /settings (public)', api('get', '/settings'));
await call('GET /products/suggest?q=att (type-ahead)', api('get', '/products/suggest').query({ q: 'att' }));

// ---- error example: COUPON_MIN_ORDER (cart subtotal ₹18 < ₹199) ----
await api('post', '/cart/items').set(C).send({ productId: water.id, qty: 1 });
await call('POST /cart/coupon -> error COUPON_MIN_ORDER', api('post', '/cart/coupon').set(C).send({ code: 'AALI50' }));
await api('delete', '/cart').set(C);

// ---- address ----
await call('POST /addresses', api('post', '/addresses').set(C).send({ label: 'Home', line1: '123 MG Road', line2: 'Near Bus Stand', landmark: 'Opposite Petrol Pump', city: 'Sitapur', state: 'Uttar Pradesh', pincode: '261001', isDefault: true }));
const addrs = await call('GET /addresses', api('get', '/addresses').set(C));
await call('GET /serviceability?pincode=261001', api('get', '/serviceability').query({ pincode: '261001' }));
await call('GET /serviceability?pincode=991234 (not in the pincode list)', api('get', '/serviceability').query({ pincode: '991234' }));
const addressId = addrs.body.data[0].id;

// ---- cart with coupon ----
await api('post', '/cart/items').set(C).send({ productId: atta.id, qty: 1 });
await call('POST /cart/coupon (success)', api('post', '/cart/coupon').set(C).send({ code: 'AALI50' }));
await call('GET /cart (1 item + coupon applied)', api('get', '/cart').set(C));

// ---- orders ----
const order = await call('POST /orders', api('post', '/orders').set(C).set('Idempotency-Key', 'sample-key-1').send({ addressId, paymentMethod: 'cod' }));
const orderId = order.body.data.id;
await api('patch', `/admin/orders/${orderId}/status`).set(A).send({ status: 'confirmed', note: 'Packing started' });
await call('GET /orders', api('get', '/orders').set(C));
await call('GET /orders/:id (statusHistory)', api('get', `/orders/${orderId}`).set(C));

// ---- reviews (needs delivered order) ----
await api('patch', `/admin/orders/${orderId}/status`).set(A).send({ status: 'delivered', note: 'Delivered' });
await call('POST /products/:id/reviews', api('post', `/products/${atta.id}/reviews`).set(C).send({ rating: 5, comment: 'Great quality atta.' }));
await call('GET /products/:id/reviews', api('get', `/products/${atta.id}/reviews`));

// ---- wishlist ----
await api('post', `/wishlist/${water.id}`).set(C);
await call('GET /wishlist', api('get', '/wishlist').set(C));

// ---- admin ----
await call('GET /admin/coupons', api('get', '/admin/coupons').set(A));
await call('GET /admin/coupons as customer -> 403', api('get', '/admin/coupons').set(C));

// ---- online payment (mock provider) ----
await api('post', '/cart/items').set(C).send({ productId: atta.id, qty: 1 });
const upi = await call('POST /orders (paymentMethod: upi) -> includes `payment`', api('post', '/orders').set(C).set('Idempotency-Key', 'sample-key-upi').send({ addressId, paymentMethod: 'upi' }));
await call('POST /payments/verify', api('post', '/payments/verify').set(C).send({ orderId: upi.body.data.id, razorpay_payment_id: 'pay_SAMPLE123', razorpay_signature: 'dev-signature' }));

// ---- admin: dashboard, lists, settings, pincodes ----
await call('GET /admin/stats', api('get', '/admin/stats').set(A));
await call('GET /admin/users', api('get', '/admin/users').set(A));
await call('GET /admin/orders?status=confirmed&from=...&q=9876 (filters)', api('get', '/admin/orders').set(A).query({ status: 'confirmed', from: new Date(Date.now() + 330 * 60000).toISOString().slice(0, 10), q: '9876' }));
await call('GET /admin/orders/:id (full order + customer)', api('get', `/admin/orders/${orderId}`).set(A));
const onion = await Product.findOne({ slug: 'fresh-onion' });
await api('delete', `/admin/products/${onion.id}`).set(A); // soft delete
await call('GET /admin/products?isActive=false (inactive products)', api('get', '/admin/products').set(A).query({ isActive: 'false' }));
await call('GET /admin/products?lowStock=true', api('get', '/admin/products').set(A).query({ lowStock: 'true', limit: 2 }));
await call('GET /admin/categories (incl. inactive)', api('get', '/admin/categories').set(A));
await call('GET /admin/banners (incl. inactive)', api('get', '/admin/banners').set(A));
await call('GET /admin/settings', api('get', '/admin/settings').set(A));
await call('PATCH /admin/settings', api('patch', '/admin/settings').set(A).send({ deliveryFee: 3000, minOrderValue: 9900 }));
await call('GET /admin/pincodes', api('get', '/admin/pincodes').set(A));
await call('POST /admin/pincodes', api('post', '/admin/pincodes').set(A).send({ pincode: '261201', areaName: { en: 'Laharpur', hi: 'लहरपुर' }, deliveryFee: null, etaDays: 2 }));

// ---- error examples from the new store rules ----
await api('post', '/cart/items').set(C).send({ productId: water.id, qty: 1 });
await call('GET /cart?pincode=110001 (this Delhi area has a ₹35 delivery-fee override)', api('get', '/cart').query({ pincode: '110001' }).set(C));
await call('POST /orders -> error MIN_ORDER_VALUE', api('post', '/orders').set(C).set('Idempotency-Key', 'sample-key-min').send({ addressId, paymentMethod: 'cod' }));
await api('patch', '/admin/settings').set(A).send({ storeOpen: false });
await call('POST /orders -> error STORE_CLOSED', api('post', '/orders').set(C).set('Idempotency-Key', 'sample-key-closed').send({ addressId, paymentMethod: 'cod' }));

// ---- write markdown ----
const md = [
  '# Aali Market — real sample responses',
  '',
  `Captured by \`npm run samples\` (scripts/capture-samples.js) — the actual app, in-memory MongoDB, seed data. IDs/timestamps/tokens differ on every run. Arrays are trimmed to ${MAX_ARRAY} items for readability.`,
  '',
  '> **Not captured:** `POST /admin/uploads` — it uploads to real S3, which needs credentials. Its response shape is documented in docs/BACKEND_REFERENCE.md.',
  '',
];
for (const s of samples) {
  md.push(`## ${s.title}`, '', `\`${s.method} ${s.url}\` → **${s.status}**`, '');
  if (s.note) md.push(`_${s.note}_`, '');
  md.push('```json', JSON.stringify(s.body, null, 2), '```', '');
}
fs.writeFileSync(path.join(root, 'docs', 'SAMPLE_RESPONSES.md'), md.join('\n'));
console.log(`Wrote ${samples.length} samples to docs/SAMPLE_RESPONSES.md`);

await mongoose.disconnect();
await rs.stop();
process.exit(0);
