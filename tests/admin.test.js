import { describe, it, expect, beforeEach } from '@jest/globals';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { env } from '../src/config/env.js';
import { createAuthedUser, createCategory, createProduct, createAddress } from './helpers.js';

const app = createApp();
const base = env.apiBasePath;

describe('Admin — orders list/detail', () => {
  let admin;
  let customer;
  let orderIds;

  async function placeOrder(who, product, addressId, key) {
    const h = { Authorization: `Bearer ${who.accessToken}` };
    await request(app).post(`${base}/cart/items`).set(h).send({ productId: product.id, qty: 1 });
    const res = await request(app).post(`${base}/orders`).set(h).set('Idempotency-Key', key).send({ addressId, paymentMethod: 'cod' });
    return res.body.data;
  }

  beforeEach(async () => {
    admin = await createAuthedUser({ role: 'admin' });
    customer = await createAuthedUser();
    const other = await createAuthedUser();
    const category = await createCategory();
    const product = await createProduct(category, { stock: 20 });
    const a1 = await createAddress(customer.user);
    const a2 = await createAddress(other.user);
    const o1 = await placeOrder(customer, product, a1._id.toString(), 'k1');
    const o2 = await placeOrder(other, product, a2._id.toString(), 'k2');
    orderIds = [o1.id, o2.id];
    await request(app)
      .patch(`${base}/admin/orders/${o2.id}/status`)
      .set({ Authorization: `Bearer ${admin.accessToken}` })
      .send({ status: 'confirmed' });
  });

  const asAdmin = () => ({ Authorization: `Bearer ${admin.accessToken}` });

  it("lists every user's orders (not just the caller's) with customer name/mobile and pagination meta", async () => {
    const res = await request(app).get(`${base}/admin/orders?page=1&limit=20`).set(asAdmin());
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(2);
    expect(res.body.meta.total).toBe(2);
    expect(res.body.data[0].user.mobile).toBeDefined();
    expect(res.body.data[0].user.id).toBeDefined();
  });

  it('filters by status', async () => {
    const res = await request(app).get(`${base}/admin/orders?status=confirmed`).set(asAdmin());
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].status).toBe('confirmed');
  });

  it('gets any order by id', async () => {
    const res = await request(app).get(`${base}/admin/orders/${orderIds[0]}`).set(asAdmin());
    expect(res.status).toBe(200);
    expect(res.body.data.id).toBe(orderIds[0]);
    expect(res.body.data.statusHistory.length).toBeGreaterThan(0);
  });

  it('forbids customers (403) and anonymous callers (401)', async () => {
    const asCustomer = await request(app).get(`${base}/admin/orders`).set({ Authorization: `Bearer ${customer.accessToken}` });
    expect(asCustomer.status).toBe(403);
    const anon = await request(app).get(`${base}/admin/orders`);
    expect(anon.status).toBe(401);
  });

  it('rejects unknown query params and bad status values', async () => {
    expect((await request(app).get(`${base}/admin/orders?foo=1`).set(asAdmin())).status).toBe(400);
    expect((await request(app).get(`${base}/admin/orders?status=nope`).set(asAdmin())).status).toBe(400);
  });
});
