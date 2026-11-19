import { describe, it, expect, beforeEach } from '@jest/globals';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { env } from '../src/config/env.js';
import { Pincode } from '../src/models/Pincode.js';
import { Product } from '../src/models/Product.js';
import { createAuthedUser, createCategory, createProduct, createAddress, placeOrder } from './helpers.js';

const app = createApp();
const base = env.apiBasePath;

describe('Store settings', () => {
  let adminH;
  let customer;
  let customerH;
  let product; // price 8000 paise
  let addressId;

  beforeEach(async () => {
    const admin = await createAuthedUser({ role: 'admin' });
    adminH = { Authorization: `Bearer ${admin.accessToken}` };
    customer = await createAuthedUser();
    customerH = { Authorization: `Bearer ${customer.accessToken}` };
    product = await createProduct(await createCategory(), { price: 8000, mrp: 9000, stock: 50 });
    addressId = (await createAddress(customer.user))._id.toString();
  });

  const patch = (body) => request(app).patch(`${base}/admin/settings`).set(adminH).send(body);
  const cart = () => request(app).get(`${base}/cart`).set(customerH);
  const addToCart = (qty = 1) => request(app).post(`${base}/cart/items`).set(customerH).send({ productId: product.id, qty });

  it('GET /settings is public and defaults to the env values (created on first read)', async () => {
    const res = await request(app).get(`${base}/settings`); // no token
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({
      deliveryFee: env.pricing.deliveryFeePaise,
      freeDeliveryThreshold: env.pricing.freeDeliveryThresholdPaise,
      handlingFee: env.pricing.handlingFeePaise,
      minOrderValue: 0,
      storeOpen: true,
      storeTimings: { open: '08:00', close: '22:00' },
      // store info (see store-info.test.js): name has a default, the rest is blank until an admin fills it in
      storeName: 'Aali Market',
      phone: '',
      whatsapp: '',
      email: '',
      address: { line1: '', city: '', state: '', pincode: '' },
      fssaiNumber: '',
      gstin: '',
    });
  });

  it('admin GET/PATCH changes values; the public endpoint and cart math follow immediately', async () => {
    const before = await addToCart(1);
    expect(before.body.data.pricing).toMatchObject({ subtotal: 8000, deliveryFee: 2500, handlingFee: 500, total: 11000 });

    const res = await patch({ deliveryFee: 4000, handlingFee: 100, freeDeliveryThreshold: 50000 });
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ deliveryFee: 4000, handlingFee: 100, freeDeliveryThreshold: 50000 });
    expect(res.body.data.updatedAt).toBeDefined();

    expect((await request(app).get(`${base}/settings`)).body.data.deliveryFee).toBe(4000);
    expect((await request(app).get(`${base}/admin/settings`).set(adminH)).body.data.deliveryFee).toBe(4000);
    expect((await cart()).body.data.pricing).toMatchObject({ deliveryFee: 4000, handlingFee: 100, total: 8000 + 4000 + 100 });

    // Free-delivery threshold is honoured: 8000 >= 5000 -> free.
    await patch({ freeDeliveryThreshold: 5000 });
    expect((await cart()).body.data.pricing.deliveryFee).toBe(0);
  });

  it('PATCH storeTimings merges instead of replacing', async () => {
    await patch({ storeTimings: { open: '07:30' } });
    const res = await request(app).get(`${base}/settings`);
    expect(res.body.data.storeTimings).toEqual({ open: '07:30', close: '22:00' });
  });

  it('validates strictly: unknown fields, negatives, floats, bad times, empty body', async () => {
    expect((await patch({ deliveryFee: -1 })).status).toBe(400);
    expect((await patch({ deliveryFee: 10.5 })).status).toBe(400);
    expect((await patch({ price: 1 })).status).toBe(400);
    expect((await patch({ storeTimings: { open: '25:00' } })).status).toBe(400);
    expect((await patch({ storeTimings: { open: '8am' } })).status).toBe(400);
    expect((await patch({ storeTimings: { lunch: '13:00' } })).status).toBe(400);
    expect((await patch({ storeOpen: 'yes' })).status).toBe(400);
    expect((await patch({})).status).toBe(400);
  });

  it('is admin-only for reads and writes', async () => {
    expect((await request(app).get(`${base}/admin/settings`).set(customerH)).status).toBe(403);
    expect((await request(app).patch(`${base}/admin/settings`).set(customerH).send({ deliveryFee: 1 })).status).toBe(403);
    expect((await request(app).patch(`${base}/admin/settings`).send({ deliveryFee: 1 })).status).toBe(401);
  });

  it('minOrderValue blocks checkout with MIN_ORDER_VALUE and details', async () => {
    await patch({ minOrderValue: 10000 });
    const res = await placeOrder(app, base, customer, product, addressId); // subtotal 8000 < 10000
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('MIN_ORDER_VALUE');
    expect(res.body.error.details).toEqual({ minOrderValue: 10000, subtotal: 8000 });
    expect((await Product.findById(product.id)).stock).toBe(50); // nothing was decremented

    await addToCart(1); // cart now holds 2 (one left over from the failed attempt) -> 16000 >= 10000
    const ok = await request(app).post(`${base}/orders`).set(customerH).set('Idempotency-Key', 'min-ok').send({ addressId, paymentMethod: 'cod' });
    expect(ok.status).toBe(201);
  });

  it('storeOpen=false rejects new orders with 503 STORE_CLOSED, but replays of an existing order still work', async () => {
    const first = await placeOrder(app, base, customer, product, addressId, { key: 'before-close' });
    expect(first.status).toBe(201);

    await patch({ storeOpen: false });
    expect((await request(app).get(`${base}/settings`)).body.data.storeOpen).toBe(false);

    const blocked = await placeOrder(app, base, customer, product, addressId, { key: 'during-close' });
    expect(blocked.status).toBe(503);
    expect(blocked.body.error.code).toBe('STORE_CLOSED');
    expect(blocked.body.error.details.storeTimings).toEqual({ open: '08:00', close: '22:00' });

    const replay = await request(app).post(`${base}/orders`).set(customerH).set('Idempotency-Key', 'before-close').send({ addressId, paymentMethod: 'cod' });
    expect(replay.status).toBe(201);
    expect(replay.body.data.id).toBe(first.body.data.id);
  });
});

describe('Serviceable areas (pincodes)', () => {
  let adminH;
  let customer;
  let customerH;
  let product;
  let addressId;

  beforeEach(async () => {
    const admin = await createAuthedUser({ role: 'admin' });
    adminH = { Authorization: `Bearer ${admin.accessToken}` };
    customer = await createAuthedUser();
    customerH = { Authorization: `Bearer ${customer.accessToken}` };
    product = await createProduct(await createCategory(), { price: 8000, mrp: 9000, stock: 50 });
    addressId = (await createAddress(customer.user, { pincode: '261001' }))._id.toString();
  });

  const create = (body) => request(app).post(`${base}/admin/pincodes`).set(adminH).send(body);
  const area = { pincode: '261001', areaName: { en: 'Sitapur', hi: 'सीतापुर' } };
  const check = (pincode) => request(app).get(`${base}/serviceability?pincode=${pincode}`);

  it('open mode: with no pincodes configured every valid pincode is serviceable', async () => {
    const res = await check('991234');
    expect(res.body.data).toEqual({ pincode: '991234', serviceable: true, etaDays: 2, etaMinutes: null, areaName: null, deliveryFee: env.pricing.deliveryFeePaise });
  });

  it('CRUD + defaults; serviceability reads the collection', async () => {
    const created = await create(area);
    expect(created.status).toBe(201);
    expect(created.body.data).toMatchObject({ pincode: '261001', isActive: true, deliveryFee: null, etaDays: 2 });
    expect(created.body.data.areaName).toEqual({ en: 'Sitapur', hi: 'सीतापुर' });
    expect(created.body.data._id).toBeUndefined();

    expect((await check('261001')).body.data).toEqual({
      pincode: '261001',
      serviceable: true,
      etaDays: 2,
      etaMinutes: null,
      areaName: { en: 'Sitapur', hi: 'सीतापुर' },
      deliveryFee: env.pricing.deliveryFeePaise,
    });
    // Once one pincode exists, unlisted ones are NOT serviceable.
    expect((await check('110001')).body.data).toEqual({ pincode: '110001', serviceable: false, etaDays: null, etaMinutes: null, areaName: null, deliveryFee: null });

    const id = created.body.data.id;
    const patched = await request(app).patch(`${base}/admin/pincodes/${id}`).set(adminH).send({ areaName: { en: 'Sitapur City' }, deliveryFee: 3000, etaDays: 4 });
    expect(patched.body.data.areaName).toEqual({ en: 'Sitapur City', hi: 'सीतापुर' }); // `hi` kept
    expect((await check('261001')).body.data).toMatchObject({ etaDays: 4, deliveryFee: 3000 });

    const cleared = await request(app).patch(`${base}/admin/pincodes/${id}`).set(adminH).send({ deliveryFee: null });
    expect(cleared.body.data.deliveryFee).toBeNull();

    await request(app).patch(`${base}/admin/pincodes/${id}`).set(adminH).send({ isActive: false });
    expect((await check('261001')).body.data.serviceable).toBe(false); // inactive => not serviceable

    const list = await request(app).get(`${base}/admin/pincodes`).set(adminH);
    expect(list.body.data).toHaveLength(1);
    expect(list.body.meta).toMatchObject({ total: 1, page: 1, limit: 20, pages: 1 });
    expect((await request(app).get(`${base}/admin/pincodes?isActive=true`).set(adminH)).body.data).toHaveLength(0);
    expect((await request(app).get(`${base}/admin/pincodes?q=sitap`).set(adminH)).body.data).toHaveLength(1);
    expect((await request(app).get(`${base}/admin/pincodes?q=2610`).set(adminH)).body.data).toHaveLength(1);

    const del = await request(app).delete(`${base}/admin/pincodes/${id}`).set(adminH);
    expect(del.status).toBe(200);
    expect((await request(app).delete(`${base}/admin/pincodes/${id}`).set(adminH)).status).toBe(404);
    expect((await request(app).delete(`${base}/admin/pincodes/${id}`).set(adminH)).body.error.code).toBe('PINCODE_NOT_FOUND');
  });

  it('rejects duplicates (409), bad pincodes, unknown fields, missing hi name, and non-admins', async () => {
    expect((await create(area)).status).toBe(201);
    const dup = await create(area);
    expect(dup.status).toBe(409);
    expect(dup.body.error.code).toBe('DUPLICATE_KEY');

    expect((await create({ ...area, pincode: '12345' })).status).toBe(400);
    expect((await create({ ...area, pincode: '061001' })).status).toBe(400);
    expect((await create({ ...area, extra: 1 })).status).toBe(400);
    expect((await create({ ...area, pincode: '226001', areaName: { en: 'Only English' } })).status).toBe(400);
    expect((await create({ ...area, pincode: '226001', etaDays: 99 })).status).toBe(400);
    expect((await create({ ...area, pincode: '226001', deliveryFee: -5 })).status).toBe(400);

    expect((await request(app).get(`${base}/admin/pincodes`).set(customerH)).status).toBe(403);
    expect((await request(app).post(`${base}/admin/pincodes`).set(customerH).send(area)).status).toBe(403);
  });

  it('checkout: unlisted pincode -> 400 NOT_SERVICEABLE, nothing decremented', async () => {
    await create({ ...area, pincode: '226001', areaName: { en: 'Lucknow', hi: 'लखनऊ' } }); // customer is at 261001
    const res = await placeOrder(app, base, customer, product, addressId);
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('NOT_SERVICEABLE');
    expect(res.body.error.details).toEqual({ pincode: '261001' });
    expect((await Product.findById(product.id)).stock).toBe(50);
  });

  it('checkout uses the pincode fee override and etaDays; cart ?pincode= previews the same total', async () => {
    await create({ ...area, deliveryFee: 3000, etaDays: 5 });

    // cart preview: without ?pincode the base fee (2500), with it the override (3000)
    await request(app).post(`${base}/cart/items`).set(customerH).send({ productId: product.id, qty: 1 });
    const plain = await request(app).get(`${base}/cart`).set(customerH);
    const preview = await request(app).get(`${base}/cart?pincode=261001`).set(customerH);
    expect(plain.body.data.pricing.deliveryFee).toBe(2500);
    expect(preview.body.data.pricing.deliveryFee).toBe(3000);
    // an unserviceable / unknown pincode never breaks the cart, it just falls back to the base fee
    expect((await request(app).get(`${base}/cart?pincode=999999`).set(customerH)).body.data.pricing.deliveryFee).toBe(2500);
    expect((await request(app).get(`${base}/cart?pincode=abc`).set(customerH)).status).toBe(400);

    const res = await request(app).post(`${base}/orders`).set(customerH).set('Idempotency-Key', 'fee-eta').send({ addressId, paymentMethod: 'cod' });
    expect(res.status).toBe(201);
    expect(res.body.data.pricing).toEqual(preview.body.data.pricing); // checkout == preview
    const days = (new Date(res.body.data.expectedDeliveryAt) - Date.now()) / 86400000;
    expect(days).toBeGreaterThan(4.9);
    expect(days).toBeLessThan(5.1);
  });

  it('the free-delivery threshold still waives an overridden fee', async () => {
    await create({ ...area, deliveryFee: 3000 });
    await request(app).patch(`${base}/admin/settings`).set(adminH).send({ freeDeliveryThreshold: 5000 });
    const res = await placeOrder(app, base, customer, product, addressId); // subtotal 8000 >= 5000
    expect(res.body.data.pricing.deliveryFee).toBe(0);
  });

  it('serviceability validates its query', async () => {
    expect((await check('12')).status).toBe(400);
    expect((await request(app).get(`${base}/serviceability`)).status).toBe(400);
    expect((await Pincode.countDocuments())).toBe(0);
  });
});
