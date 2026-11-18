import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import crypto from 'crypto';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { env } from '../src/config/env.js';
import { Order } from '../src/models/Order.js';
import { createAuthedUser, createCategory, createProduct, createAddress, placeOrder } from './helpers.js';

const app = createApp();
const base = env.apiBasePath;

const KEY_ID = 'rzp_test_abc123';
const KEY_SECRET = 'test_key_secret';
const hmac = (secret, text) => crypto.createHmac('sha256', secret).update(text).digest('hex');

describe('Online payments — order response, /payments/verify, webhook', () => {
  let customer;
  let h;
  let product;
  let addressId;
  const original = { ...env.payments };
  const originalIsProd = env.isProd;
  const originalFetch = global.fetch;

  beforeEach(async () => {
    customer = await createAuthedUser();
    h = { Authorization: `Bearer ${customer.accessToken}` };
    product = await createProduct(await createCategory(), { price: 8000, mrp: 9000, stock: 50 });
    addressId = (await createAddress(customer.user))._id.toString();
  });

  afterEach(() => {
    Object.assign(env.payments, original);
    env.isProd = originalIsProd;
    global.fetch = originalFetch;
  });

  const verify = (body, headers = h) => request(app).post(`${base}/payments/verify`).set(headers).send(body);
  const useRazorpay = () => {
    env.payments.provider = 'razorpay';
    env.payments.razorpayKeyId = KEY_ID;
    env.payments.razorpayKeySecret = KEY_SECRET;
  };
  const stubRazorpayOk = (id = 'order_RZP0001') => {
    global.fetch = jest.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({ id, amount: 11000, currency: 'INR', status: 'created' }),
    }));
    return global.fetch;
  };

  describe('mock provider', () => {
    it('COD orders carry no payment block; UPI orders carry what the client needs to pay', async () => {
      const cod = await placeOrder(app, base, customer, product, addressId, { paymentMethod: 'cod' });
      expect(cod.body.data.payment).toBeNull();

      const upi = await placeOrder(app, base, customer, product, addressId, { paymentMethod: 'upi' });
      expect(upi.status).toBe(201);
      expect(upi.body.data.payment).toEqual({
        provider: 'mock',
        keyId: null,
        providerOrderId: expect.stringMatching(/^order_mock_/),
        amount: upi.body.data.pricing.total,
        currency: 'INR',
      });
      expect(upi.body.data.paymentProviderOrderId).toBe(upi.body.data.payment.providerOrderId);
      expect(upi.body.data.paymentStatus).toBe('pending');
    });

    it('an idempotent replay returns the same payment block', async () => {
      const first = await placeOrder(app, base, customer, product, addressId, { paymentMethod: 'card', key: 'pay-replay' });
      const second = await request(app).post(`${base}/orders`).set(h).set('Idempotency-Key', 'pay-replay').send({ addressId, paymentMethod: 'card' });
      expect(second.body.data.id).toBe(first.body.data.id);
      expect(second.body.data.payment).toEqual(first.body.data.payment);
    });

    it('verify marks the order paid + confirmed, stores the payment id, and is idempotent', async () => {
      const order = (await placeOrder(app, base, customer, product, addressId, { paymentMethod: 'upi' })).body.data;
      const body = { orderId: order.id, razorpay_payment_id: 'pay_mock_1', razorpay_signature: 'any-signature' };

      const res = await verify(body);
      expect(res.status).toBe(200);
      expect(res.body.data).toMatchObject({ paymentStatus: 'paid', status: 'confirmed', paymentId: 'pay_mock_1' });
      expect(res.body.data.statusHistory.map((s) => s.status)).toEqual(['placed', 'confirmed']);
      expect(res.body.data.payment.providerOrderId).toBe(order.paymentProviderOrderId);

      const again = await verify(body);
      expect(again.status).toBe(200);
      expect(again.body.data.statusHistory).toHaveLength(2); // not duplicated
    });

    it('rejects: COD orders, someone else\'s order, unknown/missing fields, bad ids', async () => {
      const cod = (await placeOrder(app, base, customer, product, addressId)).body.data;
      const base2 = { razorpay_payment_id: 'pay_x1', razorpay_signature: 'sig' };

      const forCod = await verify({ orderId: cod.id, ...base2 });
      expect(forCod.status).toBe(400);
      expect(forCod.body.error.code).toBe('PAYMENT_NOT_REQUIRED');

      const upi = (await placeOrder(app, base, customer, product, addressId, { paymentMethod: 'upi' })).body.data;
      const stranger = await createAuthedUser();
      const foreign = await verify({ orderId: upi.id, ...base2 }, { Authorization: `Bearer ${stranger.accessToken}` });
      expect(foreign.status).toBe(404);
      expect(foreign.body.error.code).toBe('ORDER_NOT_FOUND');

      expect((await verify({ orderId: upi.id, ...base2, extra: 1 })).status).toBe(400);
      expect((await verify({ orderId: upi.id, razorpay_payment_id: 'pay_x1' })).status).toBe(400);
      expect((await verify({ orderId: 'nope', ...base2 })).status).toBe(400);
      expect((await request(app).post(`${base}/payments/verify`).send({ orderId: upi.id, ...base2 })).status).toBe(401);
    });

    it('cannot pay a cancelled order', async () => {
      const upi = (await placeOrder(app, base, customer, product, addressId, { paymentMethod: 'upi' })).body.data;
      await request(app).post(`${base}/orders/${upi.id}/cancel`).set(h).send({});
      const res = await verify({ orderId: upi.id, razorpay_payment_id: 'pay_x1', razorpay_signature: 'sig' });
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('ORDER_NOT_PAYABLE');
    });

    it('in production the mock provider never verifies (so nobody can mark their own order paid)', async () => {
      const upi = (await placeOrder(app, base, customer, product, addressId, { paymentMethod: 'upi' })).body.data;
      env.isProd = true;
      const res = await verify({ orderId: upi.id, razorpay_payment_id: 'pay_x1', razorpay_signature: 'anything' });
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('PAYMENT_SIGNATURE_INVALID');
      expect((await Order.findById(upi.id)).paymentStatus).toBe('pending');
    });
  });

  describe('razorpay provider', () => {
    it('creates a REAL Razorpay order (basic-auth, amount in paise) and returns keyId + providerOrderId', async () => {
      useRazorpay();
      const fetchMock = stubRazorpayOk('order_RZP0001');

      const res = await placeOrder(app, base, customer, product, addressId, { paymentMethod: 'upi' });
      expect(res.status).toBe(201);
      expect(res.body.data.payment).toEqual({
        provider: 'razorpay',
        keyId: KEY_ID,
        providerOrderId: 'order_RZP0001',
        amount: 11000,
        currency: 'INR',
      });

      expect(fetchMock).toHaveBeenCalledTimes(1);
      const [url, init] = fetchMock.mock.calls[0];
      expect(url).toBe('https://api.razorpay.com/v1/orders');
      expect(init.method).toBe('POST');
      expect(init.headers.Authorization).toBe(`Basic ${Buffer.from(`${KEY_ID}:${KEY_SECRET}`).toString('base64')}`);
      expect(JSON.parse(init.body)).toEqual({ amount: 11000, currency: 'INR', receipt: res.body.data.orderNumber });
    });

    it('COD never calls Razorpay', async () => {
      useRazorpay();
      const fetchMock = stubRazorpayOk();
      await placeOrder(app, base, customer, product, addressId, { paymentMethod: 'cod' });
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('verifies the checkout signature = HMAC(order_id|payment_id, key secret)', async () => {
      useRazorpay();
      stubRazorpayOk('order_RZP0002');
      const order = (await placeOrder(app, base, customer, product, addressId, { paymentMethod: 'card' })).body.data;

      const bad = await verify({ orderId: order.id, razorpay_payment_id: 'pay_RZP1', razorpay_signature: hmac('wrong-secret', 'order_RZP0002|pay_RZP1') });
      expect(bad.status).toBe(400);
      expect(bad.body.error.code).toBe('PAYMENT_SIGNATURE_INVALID');
      expect((await Order.findById(order.id)).paymentStatus).toBe('pending'); // a bad signature changes nothing

      const shortSig = await verify({ orderId: order.id, razorpay_payment_id: 'pay_RZP1', razorpay_signature: 'abc' });
      expect(shortSig.status).toBe(400); // length mismatch must not throw a 500

      const mismatch = await verify({
        orderId: order.id,
        razorpay_payment_id: 'pay_RZP1',
        razorpay_order_id: 'order_SOMEONE_ELSE',
        razorpay_signature: hmac(KEY_SECRET, 'order_SOMEONE_ELSE|pay_RZP1'),
      });
      expect(mismatch.status).toBe(400); // client cannot swap in a different (cheaper) Razorpay order

      const good = await verify({
        orderId: order.id,
        razorpay_payment_id: 'pay_RZP1',
        razorpay_order_id: 'order_RZP0002', // optional, accepted when it matches
        razorpay_signature: hmac(KEY_SECRET, 'order_RZP0002|pay_RZP1'),
      });
      expect(good.status).toBe(200);
      expect(good.body.data).toMatchObject({ paymentStatus: 'paid', status: 'confirmed', paymentId: 'pay_RZP1' });
    });

    it('a Razorpay outage returns 502 PAYMENT_PROVIDER_ERROR; retrying with the same Idempotency-Key recovers the SAME order', async () => {
      useRazorpay();
      global.fetch = jest.fn(async () => ({ ok: false, status: 500, json: async () => ({ error: { description: 'boom' } }) }));
      const failed = await placeOrder(app, base, customer, product, addressId, { paymentMethod: 'upi', key: 'outage-key' });
      expect(failed.status).toBe(502);
      expect(failed.body.error.code).toBe('PAYMENT_PROVIDER_ERROR');
      expect(failed.body.error.message).not.toMatch(/boom/); // provider internals are not leaked
      expect(await Order.countDocuments()).toBe(1); // the order exists, awaiting a payment order

      stubRazorpayOk('order_RZP_RETRY');
      const retry = await request(app).post(`${base}/orders`).set(h).set('Idempotency-Key', 'outage-key').send({ addressId, paymentMethod: 'upi' });
      expect(retry.status).toBe(201);
      expect(retry.body.data.payment.providerOrderId).toBe('order_RZP_RETRY');
      expect(await Order.countDocuments()).toBe(1); // still one order, one stock decrement
    });

    it('unconfigured keys fail loudly with 503, and a network error maps to 502', async () => {
      env.payments.provider = 'razorpay';
      env.payments.razorpayKeyId = '';
      env.payments.razorpayKeySecret = '';
      const noKeys = await placeOrder(app, base, customer, product, addressId, { paymentMethod: 'upi', key: 'nokeys' });
      expect(noKeys.status).toBe(503);

      useRazorpay();
      global.fetch = jest.fn(async () => {
        throw new Error('ECONNRESET');
      });
      const net = await request(app).post(`${base}/orders`).set(h).set('Idempotency-Key', 'nokeys').send({ addressId, paymentMethod: 'upi' });
      expect(net.status).toBe(502);
    });
  });

  describe('webhook', () => {
    const hook = (payload, signature = 'sig') =>
      request(app).post(`${base}/payments/webhook`).set('x-webhook-signature', signature).send(payload);

    it('payment captured => paid + confirmed with the gateway payment id; a late "failed" cannot undo it', async () => {
      const order = (await placeOrder(app, base, customer, product, addressId, { paymentMethod: 'upi' })).body.data;
      const entity = (status) => ({ payload: { payment: { entity: { id: 'pay_WH1', order_id: order.paymentProviderOrderId, status } } } });

      expect((await hook(entity('captured'))).status).toBe(200);
      let doc = await Order.findById(order.id);
      expect(doc).toMatchObject({ paymentStatus: 'paid', status: 'confirmed', paymentId: 'pay_WH1' });
      expect(doc.statusHistory.map((s) => s.status)).toEqual(['placed', 'confirmed']);

      await hook(entity('captured')); // duplicate delivery
      await hook(entity('failed')); // out-of-order failure event
      doc = await Order.findById(order.id);
      expect(doc.paymentStatus).toBe('paid');
      expect(doc.statusHistory).toHaveLength(2);
    });

    it('a failed payment marks the order failed, and a later successful retry still flips it to paid', async () => {
      const order = (await placeOrder(app, base, customer, product, addressId, { paymentMethod: 'upi' })).body.data;
      const entity = (status) => ({ payload: { payment: { entity: { id: 'pay_WH2', order_id: order.paymentProviderOrderId, status } } } });
      await hook(entity('failed'));
      expect((await Order.findById(order.id)).paymentStatus).toBe('failed');
      await hook(entity('captured'));
      expect((await Order.findById(order.id)).paymentStatus).toBe('paid');
    });

    it('verifies the HMAC of the raw body with the razorpay provider, and acks unknown orders with 200', async () => {
      env.payments.provider = 'razorpay';
      const payload = { payload: { payment: { entity: { id: 'pay_X', order_id: 'order_unknown', status: 'captured' } } } };
      const raw = JSON.stringify(payload);
      const sig = hmac(env.payments.webhookSecret, raw);

      const bad = await request(app).post(`${base}/payments/webhook`).set('Content-Type', 'application/json').set('x-razorpay-signature', 'deadbeef').send(raw);
      expect(bad.status).toBe(400);
      expect(bad.body.error.code).toBe('PAYMENT_SIGNATURE_INVALID');

      const ok = await request(app).post(`${base}/payments/webhook`).set('Content-Type', 'application/json').set('x-razorpay-signature', sig).send(raw);
      expect(ok.status).toBe(200);
      expect(ok.body.data).toEqual({ received: true, matched: false });
    });

    it('the mock webhook is rejected in production', async () => {
      env.isProd = true;
      const res = await hook({ orderId: 'order_mock_x', status: 'captured' });
      expect(res.status).toBe(400);
    });
  });
});
