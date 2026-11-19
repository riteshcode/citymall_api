import { describe, it, expect, beforeEach } from '@jest/globals';
import mongoose from 'mongoose';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { env } from '../src/config/env.js';
import { Order } from '../src/models/Order.js';
import { createAuthedUser, createCategory, createProduct, createAddress, placeOrder, adminSetStatus, bearer, istDate } from './helpers.js';

const app = createApp();
const base = env.apiBasePath;

// IST helpers (the API's "day" is the IST day)
const istMidnight = (yyyyMmDd) => Date.parse(`${yyyyMmDd}T00:00:00+05:30`);
const istDay = (date) => new Date(date.getTime() + 330 * 60000).toISOString().slice(0, 10);
const mondayOf = (yyyyMmDd) => {
  const d = new Date(`${yyyyMmDd}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
  return d.toISOString().slice(0, 10);
};
const oid = (id) => new mongoose.Types.ObjectId(id);
const backdate = (id, at) => Order.collection.updateOne({ _id: oid(id) }, { $set: { createdAt: new Date(at) } });

describe('Admin reports', () => {
  let admin;
  let adminH;
  let customer;
  let addressId;
  let tea; // 8000
  let biscuits; // 3000
  const earning = []; // [{ id, createdAt, total, items: [[productId, qty, price]] }] that SHOULD count

  const mk = async (product, qty, at, opts = {}) => {
    const res = await placeOrder(app, base, customer, product, addressId, { qty, ...opts });
    expect(res.status).toBe(201);
    const order = res.body.data;
    if (at !== undefined) await backdate(order.id, at);
    return { order, createdAt: new Date(at ?? Date.now()) };
  };
  const keep = async (product, qty, at, opts) => {
    const { order, createdAt } = await mk(product, qty, at, opts);
    earning.push({ id: order.id, createdAt, total: order.pricing.total, product, qty });
    return order;
  };

  const T = istDate(0);
  const Y = istDate(1);

  beforeEach(async () => {
    earning.length = 0;
    admin = await createAuthedUser({ role: 'admin' });
    adminH = bearer(admin);
    customer = await createAuthedUser();
    addressId = (await createAddress(customer.user))._id.toString();
    const category = await createCategory();
    tea = await createProduct(category, { price: 8000, mrp: 9000, stock: 500, title: { en: 'Tea', hi: 'चाय' } });
    biscuits = await createProduct(category, { price: 3000, mrp: 3000, stock: 500, title: { en: 'Biscuits', hi: 'बिस्कुट' } });
  });

  /** orders on several IST days + ones that must NOT count (cancelled, payment failed) */
  async function seedSales() {
    await keep(tea, 1, undefined); // today
    await keep(tea, 3, undefined); // today (free delivery)
    await keep(biscuits, 5, undefined); // today
    await keep(tea, 1, istMidnight(T) + 15 * 60000); // 00:15 IST today  == 18:45Z the day before: IST day must win over the UTC day
    await keep(tea, 1, istMidnight(Y) + 11 * 3600000); // yesterday midday
    await keep(tea, 1, istMidnight(T) - 15 * 60000); // 23:45 IST yesterday
    await keep(biscuits, 1, istMidnight(istDate(10)) + 12 * 3600000); // 10 days ago

    const cancelled = (await mk(tea, 1, undefined)).order;
    await request(app).post(`${base}/orders/${cancelled.id}/cancel`).set(bearer(customer)).send({});
    const failed = (await mk(tea, 1, undefined, { paymentMethod: 'upi' })).order;
    await request(app)
      .post(`${base}/payments/webhook`)
      .set('x-webhook-signature', 'sig')
      .send({ payload: { payment: { entity: { id: 'pay_F', order_id: failed.paymentProviderOrderId, status: 'failed' } } } });
  }

  const sales = (qs = '') => request(app).get(`${base}/admin/reports/sales${qs}`).set(adminH);
  const expectedBy = (keyOf) => {
    const groups = new Map();
    for (const o of earning) {
      const k = keyOf(istDay(o.createdAt));
      const g = groups.get(k) ?? { period: k, orders: 0, revenue: 0 };
      g.orders += 1;
      g.revenue += o.total;
      groups.set(k, g);
    }
    return [...groups.values()]
      .sort((a, b) => a.period.localeCompare(b.period))
      .map((g) => ({ ...g, avgOrderValue: Math.round(g.revenue / g.orders) }));
  };

  // ------------------------------------------------------------------ sales
  describe('GET /admin/reports/sales', () => {
    it('groups by IST day (default), excludes cancelled and payment-failed orders, integer paise, oldest first', async () => {
      await seedSales();
      const res = await sales();
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toEqual(expectedBy((d) => d));

      const byPeriod = Object.fromEntries(res.body.data.map((r) => [r.period, r]));
      expect(byPeriod[T].orders).toBe(4); // includes the 00:15 IST order whose UTC date is still "yesterday"
      expect(byPeriod[Y].orders).toBe(2); // includes the 23:45 IST order
      expect(res.body.data.every((r) => Number.isInteger(r.revenue) && Number.isInteger(r.avgOrderValue))).toBe(true);
      expect(res.body.data.map((r) => r.period)).toEqual([...res.body.data.map((r) => r.period)].sort());
    });

    it('groups by week (period = the Monday that starts the week) and by month (YYYY-MM)', async () => {
      await seedSales();
      const week = await sales('?groupBy=week&from=' + istDate(40));
      expect(week.body.data).toEqual(expectedBy(mondayOf));
      expect(week.body.data.every((r) => new Date(`${r.period}T00:00:00Z`).getUTCDay() === 1)).toBe(true);

      const month = await sales('?groupBy=month&from=' + istDate(40));
      expect(month.body.data).toEqual(expectedBy((d) => d.slice(0, 7)));
    });

    it('from / to narrow the range (date-only values cover the whole IST day); the default is the last 30 days', async () => {
      await seedSales();
      const old = await keep(tea, 1, istMidnight(istDate(45)) + 3600000); // 45 days ago
      expect((await sales(`?from=${Y}&to=${Y}`)).body.data.map((r) => [r.period, r.orders])).toEqual([[Y, 2]]);
      expect((await sales(`?from=${T}`)).body.data.map((r) => [r.period, r.orders])).toEqual([[T, 4]]);
      expect((await sales(`?to=${istDate(5)}`)).body.data.map((r) => r.period)).toEqual([istDate(10)]);

      const dflt = await sales();
      expect(dflt.body.data.some((r) => r.period === istDay(new Date(Date.parse(`${istDate(45)}T00:00:00+05:30`) + 3600000)))).toBe(false);
      const explicit = await sales(`?from=${istDate(46)}`);
      expect(explicit.body.data.some((r) => r.period === istDay(new Date(Date.parse(`${istDate(45)}T00:00:00+05:30`) + 3600000)))).toBe(true);
      expect(old.id).toBeDefined();
    });

    it('is an empty list (not an error) when nothing matches', async () => {
      const res = await sales();
      expect(res.status).toBe(200);
      expect(res.body.data).toEqual([]);
    });

    it('rejects bad input and non-admins', async () => {
      for (const qs of ['?groupBy=year', `?from=${T}&to=${Y}`, '?from=2026-02-31', '?from=yesterday', '?foo=1', '?groupBy=']) {
        const res = await sales(qs);
        expect([qs, res.status]).toEqual([qs, 400]);
      }
      expect((await request(app).get(`${base}/admin/reports/sales`).set(bearer(customer))).status).toBe(403);
      expect((await request(app).get(`${base}/admin/reports/sales`)).status).toBe(401);
    });
  });

  // ------------------------------------------------------------------ top products
  describe('GET /admin/reports/top-products', () => {
    const top = (qs = '') => request(app).get(`${base}/admin/reports/top-products${qs}`).set(adminH);

    it('ranks by quantity sold with revenue = price x qty, only counting earning orders', async () => {
      await seedSales();
      const sum = (product) => earning.filter((e) => e.product === product).reduce((s, e) => s + e.qty, 0);
      const res = await top();
      expect(res.status).toBe(200);
      expect(res.body.data).toEqual([
        { productId: tea.id, variantId: null, variantLabel: null, title: { en: 'Tea', hi: 'चाय' }, qtySold: sum(tea), revenue: sum(tea) * 8000 },
        { productId: biscuits.id, variantId: null, variantLabel: null, title: { en: 'Biscuits', hi: 'बिस्कुट' }, qtySold: sum(biscuits), revenue: sum(biscuits) * 3000 },
      ]);
      // the cancelled and the payment-failed orders were tea orders and are NOT in that number
      expect(sum(tea)).toBe(1 + 3 + 1 + 1 + 1);
    });

    it('honours limit and the date range; ties on quantity are broken by revenue', async () => {
      await seedSales();
      expect((await top('?limit=1')).body.data.map((r) => r.productId)).toEqual([tea.id]);

      // today only: tea 1+3+1 = 5 units, biscuits 5 units -> same qty, tea earns more
      const today = await top(`?from=${T}`);
      expect(today.body.data.map((r) => [r.productId, r.qtySold])).toEqual([[tea.id, 5], [biscuits.id, 5]]);
      expect((await top(`?to=${istDate(5)}`)).body.data.map((r) => r.productId)).toEqual([biscuits.id]);
    });

    it('validates limit (1-50), dates and params; admin-only; empty store -> []', async () => {
      expect((await top()).body.data).toEqual([]);
      for (const qs of ['?limit=0', '?limit=51', '?limit=abc', `?from=${T}&to=${Y}`, '?foo=1']) {
        expect([qs, (await top(qs)).status]).toEqual([qs, 400]);
      }
      expect((await top('?limit=50')).status).toBe(200);
      expect((await request(app).get(`${base}/admin/reports/top-products`).set(bearer(customer))).status).toBe(403);
    });
  });

  // ------------------------------------------------------------------ COD
  describe('GET /admin/reports/cod', () => {
    let anil;
    let bunty;
    const cod = (date) => request(app).get(`${base}/admin/reports/cod`).query({ date }).set(adminH);

    const run = async (rider, otpOrder, cash) => {
      await request(app).patch(`${base}/rider/orders/${otpOrder.id}/out-for-delivery`).set(bearer(rider)).send();
      const res = await request(app).post(`${base}/rider/orders/${otpOrder.id}/deliver`).set(bearer(rider)).send({ otp: otpOrder.deliveryOtp, cashCollected: cash });
      expect(res.status).toBe(200);
    };
    const prepared = async (rider, paymentMethod = 'cod') => {
      const order = (await placeOrder(app, base, customer, tea, addressId, { paymentMethod })).body.data;
      await adminSetStatus(app, base, admin, order.id, 'confirmed');
      if (rider) await request(app).patch(`${base}/admin/orders/${order.id}/assign`).set(adminH).send({ riderId: rider.user.id });
      return order;
    };
    const setDeliveredAt = (id, at) =>
      Order.collection.updateOne({ _id: oid(id) }, { $set: { 'statusHistory.$[e].at': new Date(at) } }, { arrayFilters: [{ 'e.status': 'delivered' }] });

    beforeEach(async () => {
      anil = await createAuthedUser({ role: 'rider', mobile: '9877700071', name: 'Anil' });
      bunty = await createAuthedUser({ role: 'rider', mobile: '9877700072', name: 'Bunty' });
    });

    it('reconciles expected vs collected per rider for COD orders DELIVERED that IST day', async () => {
      const c1 = await prepared(anil);
      await run(anil, c1, 11000);
      const c2 = await prepared(anil);
      await run(anil, c2, 11000);
      await setDeliveredAt(c2.id, istMidnight(T) + 15 * 60000); // 00:15 IST today (18:45Z yesterday in UTC) -> still today
      const c3 = await prepared(bunty);
      await run(bunty, c3, 10000); // short by 1000
      const c4 = await prepared(null); // closed by an admin: no rider, no cash figure
      await adminSetStatus(app, base, admin, c4.id, 'delivered');

      // things that must NOT show up today
      const yesterdayCod = await prepared(anil);
      await run(anil, yesterdayCod, 11000);
      await setDeliveredAt(yesterdayCod.id, istMidnight(T) - 15 * 60000); // 23:45 IST yesterday
      const online = await prepared(anil, 'upi');
      await request(app).post(`${base}/payments/webhook`).set('x-webhook-signature', 'sig').send({ payload: { payment: { entity: { id: 'pay_O', order_id: online.paymentProviderOrderId, status: 'captured' } } } });
      await run(anil, online, undefined);
      const cancelled = await prepared(anil);
      await request(app).post(`${base}/orders/${cancelled.id}/cancel`).set(bearer(customer)).send({});
      const stillOut = await prepared(bunty);
      await request(app).patch(`${base}/rider/orders/${stillOut.id}/out-for-delivery`).set(bearer(bunty)).send();

      const res = await cod(T);
      expect(res.status).toBe(200);
      expect(res.body.data).toEqual({
        date: T,
        totalExpected: 44000,
        totalCollected: 32000,
        byRider: [
          { rider: { id: anil.user.id, name: 'Anil', mobile: '9877700071' }, orders: 2, expected: 22000, collected: 22000 },
          { rider: { id: bunty.user.id, name: 'Bunty', mobile: '9877700072' }, orders: 1, expected: 11000, collected: 10000 },
          { rider: null, orders: 1, expected: 11000, collected: 0 },
        ],
      });

      const yesterday = await cod(Y);
      expect(yesterday.body.data.byRider).toEqual([{ rider: { id: anil.user.id, name: 'Anil', mobile: '9877700071' }, orders: 1, expected: 11000, collected: 11000 }]);
    });

    it('a day with no deliveries is zeros, not an error', async () => {
      const res = await cod(istDate(3));
      expect(res.body.data).toEqual({ date: istDate(3), totalExpected: 0, totalCollected: 0, byRider: [] });
    });

    it('requires a real YYYY-MM-DD date and an admin', async () => {
      for (const qs of ['', '?date=', '?date=2026-02-31', '?date=18-11-2026', '?date=2026-11-18T10:00:00Z', '?date=2026-11-18&x=1']) {
        const res = await request(app).get(`${base}/admin/reports/cod${qs}`).set(adminH);
        expect([qs, res.status]).toEqual([qs, 400]);
      }
      expect((await request(app).get(`${base}/admin/reports/cod?date=${T}`).set(bearer(customer))).status).toBe(403);
      expect((await request(app).get(`${base}/admin/reports/cod?date=${T}`).set(bearer(anil))).status).toBe(403);
    });
  });
});

describe('GET /admin/orders/latest (new-order alert)', () => {
  let adminH;
  let customer;
  let addressId;
  let product;
  const latest = (since, h = adminH) => request(app).get(`${base}/admin/orders/latest`).query({ since }).set(h);

  beforeEach(async () => {
    adminH = bearer(await createAuthedUser({ role: 'admin' }));
    customer = await createAuthedUser();
    addressId = (await createAddress(customer.user))._id.toString();
    product = await createProduct(await createCategory(), { stock: 500 });
  });

  it('returns { count, orders: [{ id, orderNumber, total, createdAt }] } newest first, at most 10, with the FULL count', async () => {
    const since = new Date(Date.now() - 60000).toISOString();
    const placed = [];
    for (let i = 0; i < 12; i += 1) placed.push((await placeOrder(app, base, customer, product, addressId)).body.data);

    const res = await latest(since);
    expect(res.status).toBe(200);
    expect(res.body.data.count).toBe(12);
    expect(res.body.data.orders).toHaveLength(10);
    expect(res.body.data.orders.map((o) => o.id)).toEqual(placed.slice(2).reverse().map((o) => o.id));
    expect(res.body.data.orders[0]).toEqual({
      id: placed[11].id,
      orderNumber: placed[11].orderNumber,
      total: placed[11].pricing.total,
      createdAt: placed[11].createdAt,
    });
    expect(Object.keys(res.body.data.orders[0]).sort()).toEqual(['createdAt', 'id', 'orderNumber', 'total']);
  });

  it('`since` is exclusive: polling with the newest createdAt you have seen returns nothing new', async () => {
    const a = (await placeOrder(app, base, customer, product, addressId)).body.data;
    const b = (await placeOrder(app, base, customer, product, addressId)).body.data;
    const beforeBoth = new Date(Date.parse(a.createdAt) - 1).toISOString();

    expect((await latest(beforeBoth)).body.data.orders.map((o) => o.id)).toEqual([b.id, a.id]);
    const afterA = await latest(a.createdAt);
    expect(afterA.body.data).toMatchObject({ count: 1 });
    expect(afterA.body.data.orders.map((o) => o.id)).toEqual([b.id]);
    expect((await latest(b.createdAt)).body.data).toEqual({ count: 0, orders: [] });
    expect((await latest(new Date(Date.now() + 3600000).toISOString())).body.data).toEqual({ count: 0, orders: [] });
  });

  it('accepts offset datetimes; rejects missing/odd `since` and extra params; is not swallowed by /orders/:id', async () => {
    await placeOrder(app, base, customer, product, addressId);
    const withOffset = new Date(Date.now() - 60000 + 330 * 60000).toISOString().replace('Z', '+05:30').replace(/T(\d\d):(\d\d)/, (m) => m); // same instant? see below
    // build a correct "+05:30" representation of one minute ago
    const ist = new Date(Date.now() - 60000 + 330 * 60000).toISOString().slice(0, 19) + '+05:30';
    expect((await latest(ist)).body.data.count).toBe(1);
    expect(withOffset).toBeDefined();

    for (const since of ['', '2026-11-18', 'yesterday', '1731900000', '2026-11-18T10:00:00']) {
      expect([since, (await latest(since)).status]).toEqual([since, 400]);
    }
    expect((await request(app).get(`${base}/admin/orders/latest`).set(adminH)).status).toBe(400);
    expect((await request(app).get(`${base}/admin/orders/latest`).query({ since: new Date().toISOString(), x: 1 }).set(adminH)).status).toBe(400);
    // /admin/orders/:id still works for real ids
    expect((await request(app).get(`${base}/admin/orders/507f1f77bcf86cd799439011`).set(adminH)).status).toBe(404);
  });

  it('counts every new order (also cancelled ones) and is admin-only', async () => {
    const since = new Date(Date.now() - 60000).toISOString();
    const o = (await placeOrder(app, base, customer, product, addressId)).body.data;
    await request(app).post(`${base}/orders/${o.id}/cancel`).set(bearer(customer)).send({});
    expect((await latest(since)).body.data.count).toBe(1);
    expect((await latest(since, bearer(customer))).status).toBe(403);
    expect((await latest(since, {})).status).toBe(401);
  });
});
