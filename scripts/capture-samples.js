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
const { Order } = await import('../src/models/Order.js');
const { generateVAPIDKeys } = await import('web-push');
const push = await import('../src/services/push.service.js');
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
  const isCsv = /text\/csv/.test(res.headers['content-type'] || '');
  let { body, note } = trimForDisplay(res.body);
  let text = null;
  if (isCsv) {
    const lines = res.text.replace(/^\uFEFF/, '').split(/\r?\n/).filter(Boolean);
    text = lines.slice(0, 5).join('\n') + (lines.length > 5 ? `\n... (${lines.length - 1} product rows in total)` : '');
    note = `Content-Type: ${res.headers['content-type']} · Content-Disposition: ${res.headers['content-disposition']} · the file starts with a UTF-8 BOM so Excel shows Hindi correctly · money columns are paise`;
  }
  samples.push({
    title,
    method: res.request.method,
    url: res.request.url.replace(/^http:\/\/127\.0\.0\.1:\d+/, ''),
    status: res.status,
    body,
    text,
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
const rev = await call('POST /products/:id/reviews', api('post', `/products/${atta.id}/reviews`).set(C).send({ rating: 5, comment: 'Great quality atta.' }));
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

// =====================================================================================================
// v3: store info, delivery note / location / OTP, payment retry, reorder, riders, reports, bulk, push
// =====================================================================================================
const todayIst = new Date(Date.now() + 330 * 60000).toISOString().slice(0, 10);

await call('PATCH /admin/settings (store info)', api('patch', '/admin/settings').set(A).send({
  storeName: 'Aali Market, Sitapur', phone: '+91 98765 43210', whatsapp: '9876543210', email: 'hello@aalimarket.in',
  address: { line1: '12 Station Road', city: 'Sitapur', state: 'Uttar Pradesh', pincode: '261001' },
  fssaiNumber: '12345678901234', gstin: '09AABCU9603R1ZX',
}));
await call('GET /settings (now with store info)', api('get', '/settings'));

const locAddr = await call('POST /addresses (with location)', api('post', '/addresses').set(C).send({
  label: 'Shop', line1: 'Gandhi Chowk', landmark: 'Opposite the temple', city: 'Sitapur', state: 'Uttar Pradesh', pincode: '261001',
  location: { lat: 27.5706, lng: 80.6822 },
}));
const locId = locAddr.body.data.id;

await api('post', '/cart/items').set(C).send({ productId: atta.id, qty: 1 });
const noted = await call('POST /orders (deliveryNote + address location; the owner sees deliveryOtp)', api('post', '/orders').set(C)
  .set('Idempotency-Key', 'sample-key-note').send({ addressId: locId, paymentMethod: 'cod', deliveryNote: 'Ring the bell twice, leave with the guard' }));
const notedId = noted.body.data.id;
const notedOtp = noted.body.data.deliveryOtp;
await call('GET /orders/:id (customer view: includes deliveryOtp)', api('get', `/orders/${notedId}`).set(C));

// ---- payment retry / switch to COD
await api('post', '/cart/items').set(C).send({ productId: atta.id, qty: 1 });
const online = await api('post', '/orders').set(C).set('Idempotency-Key', 'sample-key-retry').send({ addressId: locId, paymentMethod: 'upi' });
const onlineId = online.body.data.id;
await call('POST /orders/:id/payment (pay again with a fresh gateway order)', api('post', `/orders/${onlineId}/payment`).set(C).send());
await call('PATCH /orders/:id/payment-method (switch to cash on delivery)', api('patch', `/orders/${onlineId}/payment-method`).set(C).send({ paymentMethod: 'cod' }));
await call('POST /orders/:id/payment on a COD order -> error PAYMENT_NOT_RETRYABLE', api('post', `/orders/${onlineId}/payment`).set(C).send());

// ---- reorder (one product loses stock, one goes out of stock, so `skipped` is shown)
await api('post', '/cart/items').set(C).send({ productId: atta.id, qty: 2 });
await api('post', '/cart/items').set(C).send({ productId: water.id, qty: 1 });
const mixed = await api('post', '/orders').set(C).set('Idempotency-Key', 'sample-key-mixed').send({ addressId: locId, paymentMethod: 'cod' });
const attaStock = (await Product.findById(atta.id)).stock;
await Product.updateOne({ _id: atta._id }, { stock: 1 });
await Product.updateOne({ _id: water._id }, { stock: 0 });
await call('POST /orders/:id/reorder (qty_reduced + out_of_stock)', api('post', `/orders/${mixed.body.data.id}/reorder`).set(C).send());
await Product.updateOne({ _id: atta._id }, { stock: attaStock });
await Product.updateOne({ _id: water._id }, { stock: 300 });
await api('delete', '/cart').set(C);

// ---- riders
const riderMobile = '9877700001';
const rider = await call('POST /admin/riders', api('post', '/admin/riders').set(A).send({ name: 'Ramesh Kumar', mobile: riderMobile }));
await call('GET /admin/riders', api('get', '/admin/riders').set(A));
await call('PATCH /admin/riders/:id', api('patch', `/admin/riders/${rider.body.data.id}`).set(A).send({ name: 'Ramesh Yadav' }));
await api('patch', `/admin/orders/${notedId}/status`).set(A).send({ status: 'confirmed' });
await call('PATCH /admin/orders/:id/assign (order.rider populated; no deliveryOtp)', api('patch', `/admin/orders/${notedId}/assign`).set(A).send({ riderId: rider.body.data.id }));
await call('GET /admin/orders?q=<orderNumber> (rider { id, name, mobile } populated)', api('get', '/admin/orders').set(A).query({ q: noted.body.data.orderNumber }));

const riderLogin = await login(riderMobile, 'Ramesh Yadav');
const R = bearer(riderLogin.token);
await call('GET /rider/orders (only mine; no deliveryOtp)', api('get', '/rider/orders').set(R));
await call('PATCH /rider/orders/:id/out-for-delivery', api('patch', `/rider/orders/${notedId}/out-for-delivery`).set(R).send());
const wrong = notedOtp === '0000' ? '1111' : '0000';
await call('POST /rider/orders/:id/deliver -> error INVALID_DELIVERY_OTP', api('post', `/rider/orders/${notedId}/deliver`).set(R).send({ otp: wrong, cashCollected: noted.body.data.pricing.total }));
await call('POST /rider/orders/:id/deliver (COD: right OTP + cash)', api('post', `/rider/orders/${notedId}/deliver`).set(R).send({ otp: notedOtp, cashCollected: noted.body.data.pricing.total }));

// ---- reports + new-order alert
await call('GET /admin/reports/sales?groupBy=day', api('get', '/admin/reports/sales').set(A).query({ groupBy: 'day' }));
await call('GET /admin/reports/top-products?limit=3', api('get', '/admin/reports/top-products').set(A).query({ limit: 3 }));
await call(`GET /admin/reports/cod?date=${todayIst}`, api('get', '/admin/reports/cod').set(A).query({ date: todayIst }));
await call('GET /admin/orders/latest?since=<ISO datetime>', api('get', '/admin/orders/latest').set(A).query({ since: new Date(Date.now() - 3600000).toISOString() }));

// ---- bulk products + CSV
const three = await Product.find().sort({ createdAt: 1 }).limit(3);
await call('PATCH /admin/products/bulk (one row fails the price <= mrp check, one id is unknown)', api('patch', '/admin/products/bulk').set(A).send([
  { id: three[0].id, price: 2000, stock: 90 },
  { id: three[1].id, price: 99999999 },
  { id: '507f1f77bcf86cd799439011', stock: 1 },
]));
await call('GET /admin/products/export (CSV)', api('get', '/admin/products/export').set(A));
const importCsv = [
  'id,slug,title_en,title_hi,category_slug,brand,unit,mrp,price,stock,isActive',
  `${three[2].id},${three[2].slug},,,,,,,,120,`,
  ',sample-new-item,Sample Item,सैंपल आइटम,grocery-staples,Aali,500 g,5000,4500,25,',
  ',oops,Bad Row,गलत,no-such-category,,1 pc,100,90,5,',
].join('\n');
const attachCsv = (r) => r.attach('file', Buffer.from(importCsv, 'utf8'), { filename: 'products.csv', contentType: 'text/csv' });
await call('POST /admin/products/import?dryRun=true (validates, writes nothing)', attachCsv(api('post', '/admin/products/import').query({ dryRun: 'true' }).set(A)));
await call('POST /admin/products/import (applies the valid rows)', attachCsv(api('post', '/admin/products/import').set(A)));

// ---- reviews moderation
await call('GET /admin/reviews', api('get', '/admin/reviews').set(A));
await call('DELETE /admin/reviews/:id (ratingAvg / ratingCount recalculated)', api('delete', `/admin/reviews/${rev.body.data.id}`).set(A));

// ---- push (web-push is stubbed: no network); show what the browser would receive
const vapid = generateVAPIDKeys();
Object.assign(env.push, { publicKey: vapid.publicKey, privateKey: vapid.privateKey });
const pushed = [];
push.transport.sendNotification = async (target, payload) => { pushed.push({ endpoint: target.endpoint, payload: JSON.parse(payload) }); return { statusCode: 201 }; };
await call('GET /push/vapid-public-key', api('get', '/push/vapid-public-key'));
const browserSub = {
  endpoint: 'https://fcm.googleapis.com/fcm/send/dMq1-example-device-token',
  expirationTime: null,
  keys: { p256dh: Buffer.alloc(65, 7).toString('base64url'), auth: Buffer.alloc(16, 9).toString('base64url') },
};
await call('POST /me/push-subscriptions (the browser\'s PushSubscription JSON)', api('post', '/me/push-subscriptions').set(C).send(browserSub));
await call('POST /me/push-subscriptions -> error: endpoint is not a known push service', api('post', '/me/push-subscriptions').set(C).send({ ...browserSub, endpoint: 'https://evil.example.com/push' }));
await api('patch', `/admin/orders/${onlineId}/status`).set(A).send({ status: 'confirmed' });
await push.flushPushQueue();
samples.push({
  title: 'Web Push message the server sends on an order status change (what your service worker receives)',
  method: 'PUSH', url: `to ${pushed[0]?.endpoint}`, status: null, body: pushed[0]?.payload, text: null,
  note: 'Sent with web-push after PATCH /admin/orders/:id/status (also after rider actions and a confirmed payment). Bilingual because customers have no stored language. 404/410 from the push service deletes the subscription.',
});
await call('DELETE /me/push-subscriptions', api('delete', '/me/push-subscriptions').set(C).send({ endpoint: browserSub.endpoint }));

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
  '> **Not captured:** `POST /admin/uploads` — it uploads to real Cloudinary, which needs credentials. Shape: `201 { "success": true, "data": { "urls": ["https://res.cloudinary.com/<cloud>/image/upload/f_auto,q_auto/v<n>/aali-market/products/<id>"] }, "error": null }` (see docs/BACKEND_REFERENCE.md; the request/response handling is covered by tests/upload.test.js against a stand-in Cloudinary server).',
  '',
];
for (const s of samples) {
  md.push(`## ${s.title}`, '', s.status === null ? `\`${s.method} ${s.url}\`` : `\`${s.method} ${s.url}\` → **${s.status}**`, '');
  if (s.note) md.push(`_${s.note}_`, '');
  if (s.text !== null && s.text !== undefined) md.push('```csv', s.text, '```', '');
  else md.push('```json', JSON.stringify(s.body, null, 2), '```', '');
}
fs.writeFileSync(path.join(root, 'docs', 'SAMPLE_RESPONSES.md'), md.join('\n'));
console.log(`Wrote ${samples.length} samples to docs/SAMPLE_RESPONSES.md`);

await mongoose.disconnect();
await rs.stop();
process.exit(0);
