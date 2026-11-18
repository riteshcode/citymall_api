import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import request from 'supertest';
import { generateVAPIDKeys } from 'web-push';
import { createApp } from '../src/app.js';
import { env } from '../src/config/env.js';
import { PushSubscription } from '../src/models/PushSubscription.js';
import { transport, flushPushQueue } from '../src/services/push.service.js';
import { createAuthedUser, createCategory, createProduct, createAddress, placeOrder, adminSetStatus, bearer } from './helpers.js';

const app = createApp();
const base = env.apiBasePath;

const subscription = (host = 'fcm.googleapis.com', n = 1) => ({
  endpoint: `https://${host}/fcm/send/device-${n}`,
  expirationTime: null,
  keys: { p256dh: Buffer.alloc(65, 7).toString('base64url'), auth: Buffer.alloc(16, 9).toString('base64url') },
});

describe('Web Push (PWA)', () => {
  const saved = { push: { ...env.push }, sendNotification: transport.sendNotification };
  let vapid;
  let customer;
  let h;

  beforeEach(async () => {
    vapid = generateVAPIDKeys();
    Object.assign(env.push, { publicKey: vapid.publicKey, privateKey: vapid.privateKey, subject: 'mailto:test@example.com', extraAllowedHosts: [] });
    transport.sendNotification = jest.fn(async () => ({ statusCode: 201 }));
    customer = await createAuthedUser();
    h = bearer(customer);
  });

  afterEach(async () => {
    await flushPushQueue();
    Object.assign(env.push, saved.push);
    transport.sendNotification = saved.sendNotification;
  });

  const subscribe = (body, headers = h) => request(app).post(`${base}/me/push-subscriptions`).set(headers).send(body);
  const unsubscribe = (body, headers = h) => request(app).delete(`${base}/me/push-subscriptions`).set(headers).send(body);

  // ------------------------------------------------------------------ vapid key
  describe('GET /push/vapid-public-key', () => {
    it('is public and returns the configured key', async () => {
      const res = await request(app).get(`${base}/push/vapid-public-key`); // no token
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ success: true, data: { publicKey: vapid.publicKey }, error: null });
    });

    it('answers 503 PUSH_NOT_CONFIGURED without keys (and subscribing is refused too)', async () => {
      Object.assign(env.push, { publicKey: '', privateKey: '' });
      const res = await request(app).get(`${base}/push/vapid-public-key`);
      expect([res.status, res.body.error.code]).toEqual([503, 'PUSH_NOT_CONFIGURED']);
      expect((await subscribe(subscription())).status).toBe(503);
      expect(await PushSubscription.countDocuments()).toBe(0);
    });
  });

  // ------------------------------------------------------------------ subscribe
  describe('POST /me/push-subscriptions', () => {
    it('stores the browser subscription for the user and never echoes the keys', async () => {
      const sub = subscription();
      const res = await subscribe(sub);
      expect(res.status).toBe(201);
      expect(res.body.data).toEqual({ id: expect.stringMatching(/^[0-9a-f]{24}$/), endpoint: sub.endpoint, createdAt: expect.any(String) });
      expect(JSON.stringify(res.body)).not.toMatch(/p256dh|auth/);

      const stored = await PushSubscription.findOne({ endpoint: sub.endpoint });
      expect(stored.user.toString()).toBe(customer.user.id);
      expect(stored.keys.p256dh).toBe(sub.keys.p256dh);
      expect(stored.keys.auth).toBe(sub.keys.auth);
    });

    it('is idempotent per endpoint (refreshes the keys) and moves a shared device to whoever logs in', async () => {
      const sub = subscription();
      await subscribe(sub);
      const rotated = { ...sub, keys: { ...sub.keys, auth: Buffer.alloc(16, 3).toString('base64url') } };
      await subscribe(rotated);
      expect(await PushSubscription.countDocuments()).toBe(1);
      expect((await PushSubscription.findOne({ endpoint: sub.endpoint })).keys.auth).toBe(rotated.keys.auth);

      const other = await createAuthedUser();
      await subscribe(sub, bearer(other)); // same browser, different account
      const rows = await PushSubscription.find({ endpoint: sub.endpoint });
      expect(rows).toHaveLength(1);
      expect(rows[0].user.toString()).toBe(other.user.id);
    });

    it('keeps only the 10 newest devices per user', async () => {
      for (let i = 1; i <= 12; i += 1) await subscribe(subscription('fcm.googleapis.com', i));
      const rows = await PushSubscription.find({ user: customer.user.id });
      expect(rows).toHaveLength(10);
      const endpoints = rows.map((r) => r.endpoint);
      expect(endpoints).not.toContain(subscription('fcm.googleapis.com', 1).endpoint);
      expect(endpoints).toContain(subscription('fcm.googleapis.com', 12).endpoint);
    });

    it('accepts the browser vendors\' push services', async () => {
      for (const host of ['fcm.googleapis.com', 'updates.push.services.mozilla.com', 'wns2-par02p.notify.windows.com', 'web.push.apple.com']) {
        const res = await subscribe(subscription(host));
        expect([host, res.status]).toEqual([host, 201]);
      }
    });

    it('refuses every other endpoint — the server POSTs to this URL, so it must not be attacker-chosen (SSRF)', async () => {
      const endpoints = [
        'http://fcm.googleapis.com/fcm/send/x', // not https
        'https://evil.example.com/push',
        'https://127.0.0.1/push',
        'https://localhost/push',
        'https://169.254.169.254/latest/meta-data/',
        'https://10.0.0.5/push',
        'https://[::1]/push',
        'https://fcm.googleapis.com.evil.com/fcm/send/x', // suffix trick
        'https://evilfcm.googleapis.com.attacker.io/x',
        'https://attacker-fcm.googleapis.com/x', // looks similar, is not a subdomain of fcm.googleapis.com
        'https://user:pass@fcm.googleapis.com/fcm/send/x', // credentials in the URL
        'https://fcm.googleapis.com:8443/fcm/send/x', // odd port
        'ftp://fcm.googleapis.com/x',
        'file:///etc/passwd',
        'javascript:alert(1)',
      ];
      for (const endpoint of endpoints) {
        const res = await subscribe({ ...subscription(), endpoint });
        expect([endpoint, res.status]).toEqual([endpoint, 400]);
        expect(res.body.error.code).toBe('VALIDATION_ERROR');
      }
      expect(await PushSubscription.countDocuments()).toBe(0);
    });

    it('PUSH_EXTRA_ALLOWED_HOSTS adds another push service (suffix match)', async () => {
      expect((await subscribe(subscription('push.example.org'))).status).toBe(400);
      env.push.extraAllowedHosts = ['push.example.org'];
      expect((await subscribe(subscription('push.example.org'))).status).toBe(201);
      expect((await subscribe(subscription('eu.push.example.org', 2))).status).toBe(201);
      expect((await subscribe(subscription('notpush.example.org', 3))).status).toBe(400);
    });

    it('validates the subscription shape strictly', async () => {
      const ok = subscription();
      const bad = [
        {},
        { ...ok, endpoint: 'not a url' },
        { ...ok, endpoint: 'https://fcm.googleapis.com/' + 'x'.repeat(2100) },
        { endpoint: ok.endpoint, keys: { p256dh: ok.keys.p256dh } }, // missing auth
        { endpoint: ok.endpoint },
        { ...ok, keys: { ...ok.keys, p256dh: Buffer.alloc(64, 1).toString('base64url') } }, // wrong length
        { ...ok, keys: { ...ok.keys, auth: Buffer.alloc(17, 1).toString('base64url') } },
        { ...ok, keys: { ...ok.keys, auth: 'not base64!!' } },
        { ...ok, keys: { ...ok.keys, extra: 'x' } },
        { ...ok, extra: 1 },
        { ...ok, expirationTime: 'soon' },
      ];
      for (const body of bad) {
        const res = await subscribe(body);
        expect([JSON.stringify(body).slice(0, 60), res.status]).toEqual([JSON.stringify(body).slice(0, 60), 400]);
      }
      // browsers send expirationTime: null; a number is fine too
      expect((await subscribe({ ...ok, expirationTime: 1893456000000 })).status).toBe(201);
      expect((await subscribe(subscription('fcm.googleapis.com', 2), {})).status).toBe(401);
    });
  });

  // ------------------------------------------------------------------ unsubscribe
  describe('DELETE /me/push-subscriptions', () => {
    it('removes my subscription by endpoint (idempotent) and never someone else\'s', async () => {
      const mine = subscription('fcm.googleapis.com', 1);
      const theirs = subscription('fcm.googleapis.com', 2);
      const stranger = await createAuthedUser();
      await subscribe(mine);
      await subscribe(theirs, bearer(stranger));

      expect((await unsubscribe({ endpoint: theirs.endpoint })).body.data).toEqual({ removed: 0 }); // not mine
      expect(await PushSubscription.countDocuments()).toBe(2);

      expect((await unsubscribe({ endpoint: mine.endpoint })).body.data).toEqual({ removed: 1 });
      expect((await unsubscribe({ endpoint: mine.endpoint })).body.data).toEqual({ removed: 0 });
      expect(await PushSubscription.find().distinct('endpoint')).toEqual([theirs.endpoint]);
    });

    it('requires auth and a valid body', async () => {
      expect((await unsubscribe({ endpoint: subscription().endpoint }, {})).status).toBe(401);
      expect((await unsubscribe({})).status).toBe(400);
      expect((await unsubscribe({ endpoint: 'nope' })).status).toBe(400);
      expect((await unsubscribe({ endpoint: subscription().endpoint, extra: 1 })).status).toBe(400);
    });
  });

  // ------------------------------------------------------------------ sending
  describe('order status notifications', () => {
    let admin;
    let adminH;
    let product;
    let addressId;
    let order;

    beforeEach(async () => {
      admin = await createAuthedUser({ role: 'admin' });
      adminH = bearer(admin);
      product = await createProduct(await createCategory(), { stock: 100 });
      addressId = (await createAddress(customer.user))._id.toString();
      order = (await placeOrder(app, base, customer, product, addressId)).body.data;
    });

    const sent = () => transport.sendNotification.mock.calls;
    const payloadOf = (call) => JSON.parse(call[1]);

    it('placing an order sends nothing (the customer just did it)', async () => {
      await subscribe(subscription());
      await placeOrder(app, base, customer, product, addressId);
      await flushPushQueue();
      expect(sent()).toHaveLength(0);
    });

    it('an admin status change pushes { title, body, url } to the customer\'s browser', async () => {
      const sub = subscription();
      await subscribe(sub);
      const res = await adminSetStatus(app, base, admin, order.id, 'packed');
      expect(res.status).toBe(200);
      await flushPushQueue();

      expect(sent()).toHaveLength(1);
      const [target, body, options] = sent()[0];
      expect(target).toEqual({ endpoint: sub.endpoint, keys: sub.keys });
      expect(options).toMatchObject({ TTL: 86400 });

      const payload = JSON.parse(body);
      expect(Object.keys(payload).sort()).toEqual(['body', 'title', 'url']);
      expect(payload.title).toBe('Aali Market');
      expect(payload.url).toBe(`/orders/${order.id}`);
      expect(payload.body).toContain('Your order is packed');
      expect(payload.body).toContain('आपका ऑर्डर पैक हो गया है');
      expect(payload.body).toContain(`#${order.orderNumber}`);
    });

    it('covers every customer-visible status; "placed" is silent', async () => {
      await subscribe(subscription());
      const expectations = {
        confirmed: 'confirmed',
        packed: 'packed',
        shipped: 'shipped',
        out_for_delivery: 'out for delivery',
        delivered: 'delivered',
        cancelled: 'cancelled',
      };
      for (const [status, words] of Object.entries(expectations)) {
        transport.sendNotification.mockClear();
        await adminSetStatus(app, base, admin, order.id, status);
        await flushPushQueue();
        expect([status, sent().length]).toEqual([status, 1]);
        expect(payloadOf(sent()[0]).body).toContain(words);
      }
      transport.sendNotification.mockClear();
      await adminSetStatus(app, base, admin, order.id, 'placed');
      await flushPushQueue();
      expect(sent()).toHaveLength(0);
    });

    it('goes to every device of the order\'s customer and to nobody else', async () => {
      const stranger = await createAuthedUser();
      await subscribe(subscription('fcm.googleapis.com', 1));
      await subscribe(subscription('updates.push.services.mozilla.com', 2));
      await subscribe(subscription('fcm.googleapis.com', 3), bearer(stranger));

      await adminSetStatus(app, base, admin, order.id, 'confirmed');
      await flushPushQueue();
      expect(sent().map((c) => c[0].endpoint).sort()).toEqual([
        'https://fcm.googleapis.com/fcm/send/device-1',
        'https://updates.push.services.mozilla.com/fcm/send/device-2',
      ]);
    });

    it('uses the store name from the settings as the title', async () => {
      await request(app).patch(`${base}/admin/settings`).set(adminH).send({ storeName: 'Aali Mart Sitapur' });
      await subscribe(subscription());
      await adminSetStatus(app, base, admin, order.id, 'confirmed');
      await flushPushQueue();
      expect(payloadOf(sent()[0]).title).toBe('Aali Mart Sitapur');
    });

    it('deletes a subscription the push service reports gone (404 / 410) and keeps it on other failures', async () => {
      const gone = subscription('fcm.googleapis.com', 1);
      const flaky = subscription('fcm.googleapis.com', 2);
      const broken = subscription('fcm.googleapis.com', 3);
      const healthy = subscription('fcm.googleapis.com', 4);
      for (const s of [gone, flaky, broken, healthy]) await subscribe(s);

      transport.sendNotification = jest.fn(async (target) => {
        if (target.endpoint === gone.endpoint) throw Object.assign(new Error('Gone'), { statusCode: 410 });
        if (target.endpoint === flaky.endpoint) throw Object.assign(new Error('Server error'), { statusCode: 500 });
        if (target.endpoint === broken.endpoint) throw new Error('socket hang up'); // no status at all
        return { statusCode: 201 };
      });

      const res = await adminSetStatus(app, base, admin, order.id, 'shipped');
      expect(res.status).toBe(200); // a push failure never breaks the status change
      await flushPushQueue();
      expect(transport.sendNotification).toHaveBeenCalledTimes(4); // one bad device does not stop the others
      expect((await PushSubscription.find().distinct('endpoint')).sort()).toEqual([flaky.endpoint, broken.endpoint, healthy.endpoint].sort());

      transport.sendNotification = jest.fn(async () => {
        throw Object.assign(new Error('Not Found'), { statusCode: 404 });
      });
      await adminSetStatus(app, base, admin, order.id, 'delivered');
      await flushPushQueue();
      expect(await PushSubscription.countDocuments()).toBe(0);
    });

    it('is a no-op (and harmless) when push is not configured', async () => {
      await subscribe(subscription());
      Object.assign(env.push, { publicKey: '', privateKey: '' });
      const res = await adminSetStatus(app, base, admin, order.id, 'confirmed');
      expect(res.status).toBe(200);
      await flushPushQueue();
      expect(sent()).toHaveLength(0);
    });

    it('rider actions notify the customer: out for delivery and delivered — and the OTP is never in a push', async () => {
      const rider = await createAuthedUser({ role: 'rider', mobile: '9877700081' });
      await adminSetStatus(app, base, admin, order.id, 'confirmed');
      await request(app).patch(`${base}/admin/orders/${order.id}/assign`).set(adminH).send({ riderId: rider.user.id });
      await subscribe(subscription());
      transport.sendNotification.mockClear();

      await request(app).patch(`${base}/rider/orders/${order.id}/out-for-delivery`).set(bearer(rider)).send();
      await flushPushQueue();
      expect(sent()).toHaveLength(1);
      expect(payloadOf(sent()[0]).body).toContain('out for delivery');

      await request(app).post(`${base}/rider/orders/${order.id}/deliver`).set(bearer(rider)).send({ otp: order.deliveryOtp, cashCollected: order.pricing.total });
      await flushPushQueue();
      expect(sent()).toHaveLength(2);
      expect(payloadOf(sent()[1]).body).toContain('delivered');

      for (const call of sent()) {
        expect(call[1]).not.toContain(order.deliveryOtp + '"'); // no OTP value as a JSON string
        expect(call[1]).not.toMatch(/otp/i);
      }
    });

    it('a confirmed payment (verify + webhook) pushes "confirmed"; a wrong delivery OTP and a customer\'s own cancel do not push', async () => {
      await subscribe(subscription());
      const upi = (await placeOrder(app, base, customer, product, addressId, { paymentMethod: 'upi' })).body.data;
      transport.sendNotification.mockClear();

      const verified = await request(app)
        .post(`${base}/payments/verify`)
        .set(h)
        .send({ orderId: upi.id, razorpay_payment_id: 'pay_PUSH1', razorpay_signature: 'dev' });
      expect(verified.status).toBe(200);
      await flushPushQueue();
      expect(sent()).toHaveLength(1);
      expect(payloadOf(sent()[0]).body).toContain('confirmed');

      // the webhook for the same payment arrives afterwards: nothing changes, so nothing is pushed twice
      await request(app)
        .post(`${base}/payments/webhook`)
        .set('x-webhook-signature', 'sig')
        .send({ payload: { payment: { entity: { id: 'pay_PUSH1', order_id: upi.paymentProviderOrderId, status: 'captured' } } } });
      await flushPushQueue();
      expect(sent()).toHaveLength(1);

      // a webhook-first payment also pushes
      const second = (await placeOrder(app, base, customer, product, addressId, { paymentMethod: 'card' })).body.data;
      transport.sendNotification.mockClear();
      await request(app)
        .post(`${base}/payments/webhook`)
        .set('x-webhook-signature', 'sig')
        .send({ payload: { payment: { entity: { id: 'pay_PUSH2', order_id: second.paymentProviderOrderId, status: 'captured' } } } });
      await flushPushQueue();
      expect(sent()).toHaveLength(1);

      transport.sendNotification.mockClear();
      await request(app).post(`${base}/orders/${order.id}/cancel`).set(h).send({}); // the customer's own action
      await flushPushQueue();
      expect(sent()).toHaveLength(0);
    });
  });
});
