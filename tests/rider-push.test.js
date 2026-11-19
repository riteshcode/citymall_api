import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import request from 'supertest';
import { generateVAPIDKeys } from 'web-push';
import { createApp } from '../src/app.js';
import { env } from '../src/config/env.js';
import { PushSubscription } from '../src/models/PushSubscription.js';
import { Order } from '../src/models/Order.js';
import { transport, flushPushQueue } from '../src/services/push.service.js';
import { createAuthedUser, createCategory, createProduct, createAddress, placeOrder, bearer } from './helpers.js';

const app = createApp();
const base = env.apiBasePath;

const subscription = (n) => ({
  endpoint: `https://fcm.googleapis.com/fcm/send/device-${n}`,
  expirationTime: null,
  keys: { p256dh: Buffer.alloc(65, 7).toString('base64url'), auth: Buffer.alloc(16, 9).toString('base64url') },
});

describe('Rider push notifications', () => {
  const saved = { push: { ...env.push }, sendNotification: transport.sendNotification };
  let admin;
  let adminH;
  let customer;
  let riderA;
  let riderB;
  let order;

  beforeEach(async () => {
    const vapid = generateVAPIDKeys();
    Object.assign(env.push, { publicKey: vapid.publicKey, privateKey: vapid.privateKey, subject: 'mailto:test@example.com', extraAllowedHosts: [] });
    transport.sendNotification = jest.fn(async () => ({ statusCode: 201 }));

    admin = await createAuthedUser({ role: 'admin' });
    adminH = bearer(admin);
    customer = await createAuthedUser({ mobile: '9844400001', name: 'Customer' });
    riderA = await createAuthedUser({ role: 'rider', mobile: '9844400011', name: 'Rider A' });
    riderB = await createAuthedUser({ role: 'rider', mobile: '9844400012', name: 'Rider B' });

    const category = await createCategory();
    const product = await createProduct(category);
    const address = await createAddress(customer.user, { line2: 'Gandhi Nagar', city: 'Kushinagar' });
    order = (await placeOrder(app, base, customer, product, address._id.toString())).body.data;
  });

  afterEach(async () => {
    await flushPushQueue();
    Object.assign(env.push, saved.push);
    transport.sendNotification = saved.sendNotification;
  });

  const sent = () => transport.sendNotification.mock.calls;
  const to = (n) => sent().filter((c) => c[0].endpoint === subscription(n).endpoint).map((c) => JSON.parse(c[1]));
  const assign = async (riderId, orderId = order.id) => {
    const res = await request(app).patch(`${base}/admin/orders/${orderId}/assign`).set(adminH).send({ riderId });
    await flushPushQueue();
    return res;
  };
  const subscribe = (who, n) => request(app).post(`${base}/me/push-subscriptions`).set(bearer(who)).send(subscription(n));
  const last6 = () => order.orderNumber.slice(-6);

  it('riders can subscribe and unsubscribe with their own token', async () => {
    const res = await subscribe(riderA, 1);
    expect(res.status).toBe(201);
    expect((await PushSubscription.findOne({ endpoint: subscription(1).endpoint })).user.toString()).toBe(riderA.user.id);

    const off = await request(app).delete(`${base}/me/push-subscriptions`).set(bearer(riderA)).send({ endpoint: subscription(1).endpoint });
    expect(off.status).toBe(200);
    expect(off.body.data).toEqual({ removed: 1 });
    expect(await PushSubscription.countDocuments()).toBe(0);
  });

  it('assigning pushes "New delivery" to that rider: #<last 6 of the order number>, <area>, link /rider', async () => {
    await subscribe(riderA, 1);
    const res = await assign(riderA.user.id);
    expect(res.status).toBe(200);

    expect(sent()).toHaveLength(1);
    expect(to(1)).toEqual([{ title: 'New delivery / नई डिलीवरी', body: `#${last6()}, Gandhi Nagar`, url: '/rider' }]);
    expect(last6()).toHaveLength(6);
  });

  it('falls back to the city when the address has no area line', async () => {
    const category = await createCategory();
    const product = await createProduct(category);
    const bare = await createAuthedUser({ mobile: '9844400020' });
    const addr = await createAddress(bare.user, { line2: '', city: 'Padrauna' });
    const o = (await placeOrder(app, base, bare, product, addr._id.toString())).body.data;
    await subscribe(riderA, 1);
    await assign(riderA.user.id, o.id);
    expect(to(1)[0].body).toBe(`#${o.orderNumber.slice(-6)}, Padrauna`);
  });

  it('the push never carries the customer\'s phone, the delivery OTP or a door number', async () => {
    await subscribe(riderA, 1);
    await assign(riderA.user.id);
    const raw = sent()[0][1];
    const otp = (await Order.findById(order.id).select('+deliveryOtp')).deliveryOtp;
    expect(otp).toMatch(/^\d{4}$/);
    expect(raw).not.toContain(customer.user.mobile);
    expect(raw).not.toContain('123 Test Street');
    expect(raw).not.toMatch(new RegExp(`(?<!\\d)${otp}(?!\\d)`));
    expect(Object.keys(JSON.parse(raw)).sort()).toEqual(['body', 'title', 'url']);
  });

  it('moving the order to another rider tells BOTH: the new one "New delivery", the old one "Order reassigned"', async () => {
    await subscribe(riderA, 1);
    await subscribe(riderB, 2);
    await assign(riderA.user.id);
    transport.sendNotification.mockClear();

    const res = await assign(riderB.user.id);
    expect(res.status).toBe(200);
    expect(res.body.data.rider.id).toBe(riderB.user.id);
    expect(to(2)).toEqual([{ title: 'New delivery / नई डिलीवरी', body: `#${last6()}, Gandhi Nagar`, url: '/rider' }]);
    expect(to(1)).toEqual([{ title: 'Order reassigned / ऑर्डर बदला गया', body: `#${last6()} is no longer yours / अब आपका नहीं है`, url: '/rider' }]);
    expect(sent()).toHaveLength(2);
    // still no phone / OTP in the "reassigned" message
    expect(sent().map((c) => c[1]).join()).not.toContain(customer.user.mobile);
  });

  it('un-assigning (riderId null) tells the previous rider; assigning the SAME rider again tells nobody', async () => {
    await subscribe(riderA, 1);
    await assign(riderA.user.id);
    transport.sendNotification.mockClear();

    await assign(riderA.user.id); // no change
    expect(sent()).toHaveLength(0);

    await assign(null);
    expect(to(1)).toEqual([expect.objectContaining({ title: 'Order reassigned / ऑर्डर बदला गया', url: '/rider' })]);
    expect(sent()).toHaveLength(1);
  });

  it('every browser of the rider gets it; other riders and the customer get nothing', async () => {
    await subscribe(riderA, 1);
    await subscribe(riderA, 3); // a second device
    await subscribe(riderB, 2);
    await subscribe(customer, 4);
    await assign(riderA.user.id);
    expect(to(1)).toHaveLength(1);
    expect(to(3)).toHaveLength(1);
    expect(to(2)).toHaveLength(0);
    expect(to(4)).toHaveLength(0);
  });

  it('a rider without a subscription, missing VAPID keys or a failing push service never break the assignment', async () => {
    expect((await assign(riderA.user.id)).status).toBe(200); // no subscription: nothing to send
    expect(sent()).toHaveLength(0);

    await subscribe(riderB, 2);
    transport.sendNotification = jest.fn(async () => {
      throw Object.assign(new Error('push service down'), { statusCode: 503 });
    });
    const failing = await assign(riderB.user.id);
    expect(failing.status).toBe(200);
    expect((await Order.findById(order.id)).rider.toString()).toBe(riderB.user.id);

    Object.assign(env.push, { publicKey: '', privateKey: '' });
    transport.sendNotification = jest.fn();
    expect((await assign(riderA.user.id)).status).toBe(200);
    expect(transport.sendNotification).not.toHaveBeenCalled();
  });

  it('a rider\'s subscription is removed when the push service says it is gone (410)', async () => {
    await subscribe(riderA, 1);
    transport.sendNotification = jest.fn(async () => {
      throw Object.assign(new Error('gone'), { statusCode: 410 });
    });
    await assign(riderA.user.id);
    expect(await PushSubscription.countDocuments()).toBe(0);
  });

  it('assigning is still admin-only and still refuses delivered / cancelled orders (and sends nothing then)', async () => {
    await subscribe(riderA, 1);
    const asCustomer = await request(app).patch(`${base}/admin/orders/${order.id}/assign`).set(bearer(customer)).send({ riderId: riderA.user.id });
    expect(asCustomer.status).toBe(403);
    await Order.updateOne({ _id: order.id }, { status: 'cancelled' });
    const res = await assign(riderA.user.id);
    expect([res.status, res.body.error.code]).toEqual([400, 'ORDER_NOT_ASSIGNABLE']);
    expect(sent()).toHaveLength(0);
  });
});
