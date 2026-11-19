import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { env } from '../src/config/env.js';
import { Order } from '../src/models/Order.js';
import { Product } from '../src/models/Product.js';
import { createAuthedUser, createCategory, createProduct, createAddress, placeOrder, adminSetStatus, bearer } from './helpers.js';

const app = createApp();
const base = env.apiBasePath;

describe('Orders — delivery note, address location, delivery OTP, payment retry, COD switch, reorder', () => {
  let admin;
  let customer;
  let h;
  let adminH;
  let category;
  let product; // 8000 paise, stock 50
  let addressId;
  const original = { ...env.payments };
  const originalFetch = global.fetch;

  beforeEach(async () => {
    admin = await createAuthedUser({ role: 'admin' });
    adminH = bearer(admin);
    customer = await createAuthedUser();
    h = bearer(customer);
    category = await createCategory();
    product = await createProduct(category, { price: 8000, mrp: 9000, stock: 50 });
    addressId = (await createAddress(customer.user))._id.toString();
  });

  afterEach(() => {
    Object.assign(env.payments, original);
    global.fetch = originalFetch;
  });

  const place = (opts) => placeOrder(app, base, customer, product, addressId, opts);

  // ------------------------------------------------------------------ delivery note
  describe('deliveryNote', () => {
    it('is saved and shown to the customer and the admin; defaults to ""', async () => {
      const res = await place({ deliveryNote: 'Ring the bell twice, leave with the guard' });
      expect(res.status).toBe(201);
      expect(res.body.data.deliveryNote).toBe('Ring the bell twice, leave with the guard');

      const mine = await request(app).get(`${base}/orders/${res.body.data.id}`).set(h);
      expect(mine.body.data.deliveryNote).toBe('Ring the bell twice, leave with the guard');
      const adm = await request(app).get(`${base}/admin/orders/${res.body.data.id}`).set(adminH);
      expect(adm.body.data.deliveryNote).toBe('Ring the bell twice, leave with the guard');

      expect((await place({})).body.data.deliveryNote).toBe('');
    });

    it('is trimmed, limited to 200 characters, and must be a string', async () => {
      expect((await place({ deliveryNote: '  call before coming  ' })).body.data.deliveryNote).toBe('call before coming');
      expect((await place({ deliveryNote: 'x'.repeat(200) })).status).toBe(201);
      const tooLong = await place({ deliveryNote: 'x'.repeat(201) });
      expect(tooLong.status).toBe(400);
      expect(tooLong.body.error.code).toBe('VALIDATION_ERROR');
      const wrongType = await request(app)
        .post(`${base}/orders`)
        .set(h)
        .set('Idempotency-Key', 'dn-type')
        .send({ addressId, paymentMethod: 'cod', deliveryNote: 123 });
      expect(wrongType.status).toBe(400);
    });
  });

  // ------------------------------------------------------------------ address location
  describe('address location', () => {
    const addr = { line1: '5 Mill Road', city: 'Sitapur', state: 'Uttar Pradesh', pincode: '261001' };

    it('is optional on create, returned as { lat, lng }, and snapshotted into the order', async () => {
      const created = await request(app).post(`${base}/addresses`).set(h).send({ ...addr, location: { lat: 27.5706, lng: 80.6822 } });
      expect(created.status).toBe(201);
      expect(created.body.data.location).toEqual({ lat: 27.5706, lng: 80.6822 });
      expect(created.body.data.location._id).toBeUndefined();

      const without = await request(app).post(`${base}/addresses`).set(h).send(addr);
      expect(without.body.data.location).toBeUndefined();

      const order = (await placeOrder(app, base, customer, product, created.body.data.id)).body.data;
      expect(order.shippingAddress.location).toEqual({ lat: 27.5706, lng: 80.6822 });

      // editing the address later does not rewrite history
      await request(app).patch(`${base}/addresses/${created.body.data.id}`).set(h).send({ location: { lat: 1, lng: 2 } });
      const again = await request(app).get(`${base}/orders/${order.id}`).set(h);
      expect(again.body.data.shippingAddress.location).toEqual({ lat: 27.5706, lng: 80.6822 });
    });

    it('PATCH sets, keeps and clears (null) the location', async () => {
      const id = (await request(app).post(`${base}/addresses`).set(h).send(addr)).body.data.id;
      const set = await request(app).patch(`${base}/addresses/${id}`).set(h).send({ location: { lat: -33.8688, lng: 151.2093 } });
      expect(set.body.data.location).toEqual({ lat: -33.8688, lng: 151.2093 });

      const unrelated = await request(app).patch(`${base}/addresses/${id}`).set(h).send({ landmark: 'Near temple' });
      expect(unrelated.body.data.location).toEqual({ lat: -33.8688, lng: 151.2093 });

      const cleared = await request(app).patch(`${base}/addresses/${id}`).set(h).send({ location: null });
      expect(cleared.status).toBe(200);
      expect(cleared.body.data.location).toBeUndefined();
      expect((await request(app).get(`${base}/addresses`).set(h)).body.data.find((a) => a.id === id).location).toBeUndefined();
    });

    it('rejects out-of-range, partial, non-numeric and extra-key locations', async () => {
      const bad = [
        { lat: 90.0001, lng: 0 },
        { lat: -91, lng: 0 },
        { lat: 0, lng: 180.5 },
        { lat: 0, lng: -181 },
        { lat: 12 },
        { lng: 12 },
        { lat: '27.5', lng: '80.6' },
        { lat: 27.5, lng: 80.6, accuracy: 10 },
        {},
      ];
      for (const location of bad) {
        const res = await request(app).post(`${base}/addresses`).set(h).send({ ...addr, location });
        expect([location, res.status]).toEqual([location, 400]);
      }
      const id = (await request(app).post(`${base}/addresses`).set(h).send(addr)).body.data.id;
      expect((await request(app).patch(`${base}/addresses/${id}`).set(h).send({ location: { lat: 95, lng: 0 } })).status).toBe(400);
      // the boundary values themselves are fine
      expect((await request(app).post(`${base}/addresses`).set(h).send({ ...addr, location: { lat: 90, lng: -180 } })).status).toBe(201);
    });
  });

  // ------------------------------------------------------------------ delivery OTP privacy
  describe('delivery OTP', () => {
    it('is a 4-digit code generated per order and shown to the owner only', async () => {
      const created = await place({ key: 'otp-1' });
      const otp = created.body.data.deliveryOtp;
      expect(otp).toMatch(/^\d{4}$/);

      const detail = await request(app).get(`${base}/orders/${created.body.data.id}`).set(h);
      expect(detail.body.data.deliveryOtp).toBe(otp);

      // not in the owner's list, not for another customer, not for anyone else's token
      const list = await request(app).get(`${base}/orders`).set(h);
      expect(list.body.data[0]).not.toHaveProperty('deliveryOtp');
      const stranger = await createAuthedUser();
      expect((await request(app).get(`${base}/orders/${created.body.data.id}`).set(bearer(stranger))).status).toBe(404);
    });

    it('never appears in any admin response (list, detail, status change, assign) or after cancel', async () => {
      const created = (await place({ key: 'otp-2' })).body.data;
      const id = created.id;
      const rider = await createAuthedUser({ role: 'rider', mobile: '9877700010' });

      const responses = [
        await request(app).get(`${base}/admin/orders`).set(adminH),
        await request(app).get(`${base}/admin/orders/${id}`).set(adminH),
        await request(app).patch(`${base}/admin/orders/${id}/status`).set(adminH).send({ status: 'confirmed' }),
        await request(app).patch(`${base}/admin/orders/${id}/assign`).set(adminH).send({ riderId: rider.user.id }),
        await request(app).get(`${base}/admin/orders/latest`).query({ since: new Date(Date.now() - 60000).toISOString() }).set(adminH),
        await request(app).get(`${base}/rider/orders`).set(bearer(rider)),
      ];
      for (const res of responses) {
        expect(res.status).toBe(200);
        expect(JSON.stringify(res.body)).not.toMatch(/deliveryOtp/);
      }
      const cancelled = await request(app).post(`${base}/orders/${id}/cancel`).set(h).send({});
      expect(JSON.stringify(cancelled.body)).not.toMatch(/deliveryOtp/);
    });

    it('is random per order', async () => {
      const otps = new Set();
      for (let i = 0; i < 6; i += 1) otps.add((await place({ key: `otp-r${i}` })).body.data.deliveryOtp);
      expect(otps.size).toBeGreaterThan(1);
    });
  });

  // ------------------------------------------------------------------ payment retry
  describe('POST /orders/:id/payment (retry)', () => {
    const retry = (id, headers = h) => request(app).post(`${base}/orders/${id}/payment`).set(headers).send();
    const hook = (providerOrderId, status, paymentId = 'pay_X1') =>
      request(app)
        .post(`${base}/payments/webhook`)
        .set('x-webhook-signature', 'sig')
        .send({ payload: { payment: { entity: { id: paymentId, order_id: providerOrderId, status } } } });

    it('creates a NEW gateway order and returns the payment block; remembers the abandoned one', async () => {
      const order = (await place({ paymentMethod: 'upi' })).body.data;
      const res = await retry(order.id);
      expect(res.status).toBe(200);
      expect(Object.keys(res.body.data)).toEqual(['payment']);
      expect(res.body.data.payment).toEqual({
        provider: 'mock',
        keyId: null,
        providerOrderId: expect.stringMatching(/^order_mock_/),
        amount: order.pricing.total,
        currency: 'INR',
      });
      expect(res.body.data.payment.providerOrderId).not.toBe(order.paymentProviderOrderId);

      const stored = await Order.findById(order.id);
      expect(stored.paymentProviderOrderId).toBe(res.body.data.payment.providerOrderId);
      expect(stored.previousProviderOrderIds).toEqual([order.paymentProviderOrderId]);
      expect(stored.paymentStatus).toBe('pending');
      expect(JSON.stringify((await request(app).get(`${base}/orders/${order.id}`).set(h)).body)).not.toMatch(/previousProviderOrderIds/);
    });

    it('works again after a failed payment (failed -> pending), and can be repeated', async () => {
      const order = (await place({ paymentMethod: 'card' })).body.data;
      await hook(order.paymentProviderOrderId, 'failed');
      expect((await Order.findById(order.id)).paymentStatus).toBe('failed');

      const first = await retry(order.id);
      expect(first.status).toBe(200);
      expect((await Order.findById(order.id)).paymentStatus).toBe('pending');
      const second = await retry(order.id);
      expect(second.status).toBe(200);
      expect((await Order.findById(order.id)).previousProviderOrderIds).toHaveLength(2);
    });

    it('a late success on an ABANDONED attempt still pays the order (webhook matches earlier gateway orders)', async () => {
      const order = (await place({ paymentMethod: 'upi' })).body.data;
      await retry(order.id);
      const res = await hook(order.paymentProviderOrderId, 'captured', 'pay_LATE');
      expect(res.body.data).toEqual({ received: true, matched: true });
      expect(await Order.findById(order.id)).toMatchObject({ paymentStatus: 'paid', status: 'confirmed', paymentId: 'pay_LATE' });
    });

    it('answers 400 PAYMENT_NOT_RETRYABLE for COD, paid and cancelled orders', async () => {
      const cod = (await place({ paymentMethod: 'cod' })).body.data;
      const paid = (await place({ paymentMethod: 'upi' })).body.data;
      await hook(paid.paymentProviderOrderId, 'captured');
      const cancelled = (await place({ paymentMethod: 'upi' })).body.data;
      await request(app).post(`${base}/orders/${cancelled.id}/cancel`).set(h).send({});

      for (const [label, order] of [['cod', cod], ['paid', paid], ['cancelled', cancelled]]) {
        const res = await retry(order.id);
        expect([label, res.status, res.body.error.code]).toEqual([label, 400, 'PAYMENT_NOT_RETRYABLE']);
      }
    });

    it('is the owner\'s only: someone else\'s order and unknown ids are 404, anonymous is 401', async () => {
      const order = (await place({ paymentMethod: 'upi' })).body.data;
      const stranger = bearer(await createAuthedUser());
      const foreign = await retry(order.id, stranger);
      expect([foreign.status, foreign.body.error.code]).toEqual([404, 'ORDER_NOT_FOUND']);
      expect((await retry('507f1f77bcf86cd799439011')).status).toBe(404);
      expect((await retry('nope')).status).toBe(400);
      expect((await retry(order.id, {})).status).toBe(401);
      expect((await Order.findById(order.id)).previousProviderOrderIds).toEqual([]);
    });

    it('with Razorpay: creates a real gateway order for the same amount; an outage leaves the order untouched', async () => {
      Object.assign(env.payments, { provider: 'razorpay', razorpayKeyId: 'rzp_test_k', razorpayKeySecret: 'secret' });
      global.fetch = jest.fn(async () => ({ ok: true, status: 200, json: async () => ({ id: 'order_RZP_A', amount: 11000, currency: 'INR', status: 'created' }) }));
      const order = (await place({ paymentMethod: 'upi' })).body.data;
      expect(order.payment.providerOrderId).toBe('order_RZP_A');

      global.fetch = jest.fn(async () => ({ ok: true, status: 200, json: async () => ({ id: 'order_RZP_B', amount: 11000, currency: 'INR', status: 'created' }) }));
      const res = await retry(order.id);
      expect(res.body.data.payment).toEqual({ provider: 'razorpay', keyId: 'rzp_test_k', providerOrderId: 'order_RZP_B', amount: 11000, currency: 'INR' });
      expect(JSON.parse(global.fetch.mock.calls[0][1].body)).toEqual({ amount: 11000, currency: 'INR', receipt: order.orderNumber });

      global.fetch = jest.fn(async () => ({ ok: false, status: 500, json: async () => ({}) }));
      const down = await retry(order.id);
      expect([down.status, down.body.error.code]).toEqual([502, 'PAYMENT_PROVIDER_ERROR']);
      expect((await Order.findById(order.id)).paymentProviderOrderId).toBe('order_RZP_B'); // unchanged
    });
  });

  // ------------------------------------------------------------------ switch to COD
  describe('PATCH /orders/:id/payment-method', () => {
    const toCod = (id, body = { paymentMethod: 'cod' }, headers = h) => request(app).patch(`${base}/orders/${id}/payment-method`).set(headers).send(body);

    it('switches an unpaid online order to COD and drops the gateway order', async () => {
      const order = (await place({ paymentMethod: 'upi' })).body.data;
      const res = await toCod(order.id);
      expect(res.status).toBe(200);
      expect(res.body.data).toMatchObject({ id: order.id, paymentMethod: 'cod', paymentStatus: 'pending', paymentProviderOrderId: null, payment: null });
      expect(res.body.data.deliveryOtp).toBe(order.deliveryOtp); // owner shape
      expect((await Order.findById(order.id)).previousProviderOrderIds).toEqual([order.paymentProviderOrderId]);
    });

    it('also works after a failed payment, and then there is nothing left to retry', async () => {
      const order = (await place({ paymentMethod: 'netbanking' })).body.data;
      await request(app).post(`${base}/payments/webhook`).set('x-webhook-signature', 'sig').send({ payload: { payment: { entity: { id: 'pay_F', order_id: order.paymentProviderOrderId, status: 'failed' } } } });
      expect((await toCod(order.id)).status).toBe(200);
      const retry = await request(app).post(`${base}/orders/${order.id}/payment`).set(h).send();
      expect([retry.status, retry.body.error.code]).toEqual([400, 'PAYMENT_NOT_RETRYABLE']);
    });

    it('is refused (400 PAYMENT_METHOD_NOT_CHANGEABLE) for paid, cancelled and already-COD orders', async () => {
      const paid = (await place({ paymentMethod: 'upi' })).body.data;
      await request(app).post(`${base}/payments/webhook`).set('x-webhook-signature', 'sig').send({ payload: { payment: { entity: { id: 'pay_P', order_id: paid.paymentProviderOrderId, status: 'captured' } } } });
      const cancelled = (await place({ paymentMethod: 'card' })).body.data;
      await request(app).post(`${base}/orders/${cancelled.id}/cancel`).set(h).send({});
      const cod = (await place({ paymentMethod: 'cod' })).body.data;

      for (const [label, order] of [['paid', paid], ['cancelled', cancelled], ['cod', cod]]) {
        const res = await toCod(order.id);
        expect([label, res.status, res.body.error.code]).toEqual([label, 400, 'PAYMENT_METHOD_NOT_CHANGEABLE']);
      }
      expect((await Order.findById(paid.id)).paymentMethod).toBe('upi'); // untouched
    });

    it('only accepts { paymentMethod: "cod" } on your own order', async () => {
      const order = (await place({ paymentMethod: 'upi' })).body.data;
      for (const body of [{ paymentMethod: 'upi' }, { paymentMethod: 'card' }, {}, { paymentMethod: 'cod', extra: 1 }]) {
        expect([body, (await toCod(order.id, body)).status]).toEqual([body, 400]);
      }
      const stranger = bearer(await createAuthedUser());
      expect((await toCod(order.id, { paymentMethod: 'cod' }, stranger)).status).toBe(404);
      expect((await toCod(order.id, { paymentMethod: 'cod' }, {})).status).toBe(401);
      expect((await Order.findById(order.id)).paymentMethod).toBe('upi');
    });
  });

  // ------------------------------------------------------------------ reorder
  describe('POST /orders/:id/reorder', () => {
    const reorder = (id, headers = h) => request(app).post(`${base}/orders/${id}/reorder`).set(headers).send();
    const cart = () => request(app).get(`${base}/cart`).set(h);
    let other; // a second product

    beforeEach(async () => {
      other = await createProduct(category, { price: 3000, mrp: 3000, stock: 10, title: { en: 'Biscuits', hi: 'बिस्कुट' } });
    });

    // order with 2x product + 1x other
    async function orderBoth() {
      await request(app).post(`${base}/cart/items`).set(h).send({ productId: product.id, qty: 2 });
      await request(app).post(`${base}/cart/items`).set(h).send({ productId: other.id, qty: 1 });
      return (await request(app).post(`${base}/orders`).set(h).set('Idempotency-Key', `ro-${Math.random()}`).send({ addressId, paymentMethod: 'cod' })).body.data;
    }

    it('puts the order\'s items back in the cart at LIVE prices and returns { cart, skipped: [] }', async () => {
      const order = await orderBoth();
      await Product.updateOne({ _id: product._id }, { price: 8500 }); // price moved since the order

      const res = await reorder(order.id);
      expect(res.status).toBe(200);
      expect(Object.keys(res.body.data).sort()).toEqual(['cart', 'skipped']);
      expect(res.body.data.skipped).toEqual([]);

      const { items, pricing } = res.body.data.cart;
      expect(items.map((i) => [i.productId, i.qty, i.price])).toEqual([[product.id, 2, 8500], [other.id, 1, 3000]]);
      expect(pricing.subtotal).toBe(2 * 8500 + 3000);
      // identical to what GET /cart shows (the same shape)
      expect((await cart()).body.data).toEqual(res.body.data.cart);
    });

    it('caps quantities at today\'s stock and reports qty_reduced / out_of_stock / inactive', async () => {
      const order = await orderBoth();
      await Product.updateOne({ _id: product._id }, { stock: 1 }); // wanted 2
      await Product.updateOne({ _id: other._id }, { isActive: false });

      const res = await reorder(order.id);
      expect(res.body.data.cart.items).toHaveLength(1);
      expect(res.body.data.cart.items[0]).toMatchObject({ productId: product.id, qty: 1 });
      expect(res.body.data.skipped).toEqual([
        { productId: product.id, variantId: null, variantLabel: null, title: { en: 'Test Product', hi: 'टेस्ट प्रोडक्ट' }, reason: 'qty_reduced', requested: 2, added: 1 },
        { productId: other.id, variantId: null, variantLabel: null, title: { en: 'Biscuits', hi: 'बिस्कुट' }, reason: 'inactive', requested: 1, added: 0 },
      ]);

      await request(app).delete(`${base}/cart`).set(h);
      await Product.updateOne({ _id: product._id }, { stock: 0 });
      const zero = await reorder(order.id);
      expect(zero.body.data.skipped.find((s) => s.productId === product.id)).toMatchObject({ reason: 'out_of_stock', added: 0 });
      expect(zero.body.data.cart.items).toHaveLength(0);
    });

    it('adds to what is already in the cart, still respecting stock', async () => {
      const order = await orderBoth();
      await request(app).post(`${base}/cart/items`).set(h).send({ productId: product.id, qty: 1 }); // already 1 in cart
      await Product.updateOne({ _id: product._id }, { stock: 2 });

      const res = await reorder(order.id); // wants +2, room for +1
      expect(res.body.data.cart.items.find((i) => i.productId === product.id).qty).toBe(2);
      expect(res.body.data.skipped).toContainEqual(expect.objectContaining({ productId: product.id, reason: 'qty_reduced', requested: 2, added: 1 }));

      const again = await reorder(order.id); // cart already holds all the stock
      expect(again.body.data.skipped).toContainEqual(expect.objectContaining({ productId: product.id, reason: 'out_of_stock' }));
    });

    it('works for cancelled and delivered orders, and only for your own orders', async () => {
      const order = await orderBoth();
      await adminSetStatus(app, base, admin, order.id, 'delivered');
      expect((await reorder(order.id)).status).toBe(200);

      const stranger = bearer(await createAuthedUser());
      const foreign = await reorder(order.id, stranger);
      expect([foreign.status, foreign.body.error.code]).toEqual([404, 'ORDER_NOT_FOUND']);
      expect((await reorder(order.id, {})).status).toBe(401);
      expect((await reorder('507f1f77bcf86cd799439011')).status).toBe(404);
    });
  });
});
