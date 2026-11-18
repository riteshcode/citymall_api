import { describe, it, expect, beforeEach } from '@jest/globals';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { env } from '../src/config/env.js';
import { Order } from '../src/models/Order.js';
import { User } from '../src/models/User.js';
import { getLastOtpForTesting } from '../src/services/sms.provider.js';
import { createAuthedUser, createCategory, createProduct, createAddress, placeOrder, adminSetStatus, bearer } from './helpers.js';

const app = createApp();
const base = env.apiBasePath;
const MAX = env.deliveryOtpMaxAttempts;

describe('Riders — admin management, login, assignment', () => {
  let admin;
  let adminH;
  let customerH;

  beforeEach(async () => {
    admin = await createAuthedUser({ role: 'admin' });
    adminH = bearer(admin);
    customerH = bearer(await createAuthedUser({ mobile: '9855500001' }));
  });

  const create = (body, h = adminH) => request(app).post(`${base}/admin/riders`).set(h).send(body);

  it('creates a rider (role rider, active, no orders yet)', async () => {
    const res = await create({ name: 'Ramesh Kumar', mobile: '9877700001' });
    expect(res.status).toBe(201);
    expect(res.body.data).toEqual({
      id: expect.stringMatching(/^[0-9a-f]{24}$/),
      name: 'Ramesh Kumar',
      mobile: '9877700001',
      isActive: true,
      activeOrders: 0,
      createdAt: expect.any(String),
    });
    expect((await User.findById(res.body.data.id)).role).toBe('rider');
    expect((await create({ name: 'Off Duty', mobile: '9877700002', isActive: false })).body.data.isActive).toBe(false);
  });

  it('refuses a mobile that already belongs to anyone (rider OR customer), and bad input', async () => {
    await create({ name: 'Ramesh', mobile: '9877700001' });
    for (const mobile of ['9877700001', '9855500001']) {
      const dup = await create({ name: 'Another', mobile });
      expect([mobile, dup.status, dup.body.error.code]).toEqual([mobile, 409, 'MOBILE_ALREADY_REGISTERED']);
    }
    for (const body of [{ name: 'X', mobile: '12345' }, { name: '', mobile: '9877700009' }, { mobile: '9877700009' }, { name: 'X', mobile: '9877700009', role: 'admin' }, { name: 'X', mobile: '9877700009', isActive: 'yes' }]) {
      expect([body, (await create(body)).status]).toEqual([body, 400]);
    }
  });

  it('lists riders only (never customers/admins) with filters, pagination and activeOrders', async () => {
    const a = (await create({ name: 'Anil Rider', mobile: '9877700011' })).body.data;
    await create({ name: 'Bunty Rider', mobile: '9877700012', isActive: false });

    const all = await request(app).get(`${base}/admin/riders`).set(adminH);
    expect(all.status).toBe(200);
    expect(all.body.data.map((r) => r.name).sort()).toEqual(['Anil Rider', 'Bunty Rider']);
    expect(all.body.meta).toMatchObject({ total: 2, page: 1, limit: 20, pages: 1 });

    expect((await request(app).get(`${base}/admin/riders?isActive=true`).set(adminH)).body.data.map((r) => r.id)).toEqual([a.id]);
    expect((await request(app).get(`${base}/admin/riders?q=bunt`).set(adminH)).body.data).toHaveLength(1);
    expect((await request(app).get(`${base}/admin/riders?q=77700011`).set(adminH)).body.data).toHaveLength(1);
    expect((await request(app).get(`${base}/admin/riders?limit=1&page=2`).set(adminH)).body.data).toHaveLength(1);
    expect((await request(app).get(`${base}/admin/riders?foo=1`).set(adminH)).status).toBe(400);
    expect((await request(app).get(`${base}/admin/riders?isActive=maybe`).set(adminH)).status).toBe(400);
  });

  it('PATCH changes name / mobile / isActive; unknown id, non-rider id, taken mobile, empty body are rejected', async () => {
    const r = (await create({ name: 'Old Name', mobile: '9877700021' })).body.data;
    const patch = (id, body) => request(app).patch(`${base}/admin/riders/${id}`).set(adminH).send(body);

    const ok = await patch(r.id, { name: 'New Name', mobile: '9877700022', isActive: false });
    expect(ok.body.data).toMatchObject({ name: 'New Name', mobile: '9877700022', isActive: false });
    expect((await patch(r.id, { isActive: true })).body.data).toMatchObject({ isActive: true, mobile: '9877700022' });
    expect((await patch(r.id, { mobile: '9877700022' })).status).toBe(200); // unchanged mobile is not a conflict

    const taken = await patch(r.id, { mobile: '9855500001' });
    expect([taken.status, taken.body.error.code]).toEqual([409, 'MOBILE_ALREADY_REGISTERED']);
    const missing = await patch('507f1f77bcf86cd799439011', { name: 'X' });
    expect([missing.status, missing.body.error.code]).toEqual([404, 'RIDER_NOT_FOUND']);
    const customerId = (await User.findOne({ mobile: '9855500001' })).id;
    expect((await patch(customerId, { name: 'Promote me' })).status).toBe(404); // a customer is not a rider
    expect((await patch(customerId, { name: 'Promote me' })).body.error.code).toBe('RIDER_NOT_FOUND');
    expect((await patch(r.id, {})).status).toBe(400);
    expect((await patch(r.id, { role: 'admin' })).status).toBe(400);
  });

  it('is admin-only', async () => {
    expect((await request(app).get(`${base}/admin/riders`).set(customerH)).status).toBe(403);
    expect((await create({ name: 'X', mobile: '9877700031' }, customerH)).status).toBe(403);
    expect((await create({ name: 'X', mobile: '9877700031' }, {})).status).toBe(401);
    const riderH = bearer(await createAuthedUser({ role: 'rider', mobile: '9877700032' }));
    expect((await request(app).get(`${base}/admin/riders`).set(riderH)).status).toBe(403); // riders are not admins
    expect((await request(app).get(`${base}/admin/orders`).set(riderH)).status).toBe(403);
  });

  it('a rider logs in through the normal OTP flow and keeps role "rider"', async () => {
    await create({ name: 'Login Rider', mobile: '9877700041' });
    await request(app).post(`${base}/auth/otp/send`).send({ mobile: '9877700041', purpose: 'login' });
    const verify = await request(app)
      .post(`${base}/auth/otp/verify`)
      .send({ mobile: '9877700041', code: getLastOtpForTesting('9877700041'), purpose: 'login' });
    expect(verify.status).toBe(200);
    expect(verify.body.data.isNewUser).toBe(false);
    expect(verify.body.data.user).toMatchObject({ role: 'rider', name: 'Login Rider' });

    const orders = await request(app).get(`${base}/rider/orders`).set({ Authorization: `Bearer ${verify.body.data.accessToken}` });
    expect(orders.status).toBe(200);
  });

  it('a deactivated rider cannot log in and a token they already hold stops working', async () => {
    const r = (await create({ name: 'Fired Rider', mobile: '9877700051' })).body.data;
    const token = (await createAuthedUser({ role: 'rider', mobile: '9877700099' })).accessToken; // unrelated, stays valid

    // log in first, then get deactivated
    await request(app).post(`${base}/auth/otp/send`).send({ mobile: '9877700051', purpose: 'login' });
    const login = await request(app).post(`${base}/auth/otp/verify`).send({ mobile: '9877700051', code: getLastOtpForTesting('9877700051'), purpose: 'login' });
    const heldToken = login.body.data.accessToken;
    expect((await request(app).get(`${base}/rider/orders`).set({ Authorization: `Bearer ${heldToken}` })).status).toBe(200);

    await request(app).patch(`${base}/admin/riders/${r.id}`).set(adminH).send({ isActive: false });

    const blocked = await request(app).get(`${base}/rider/orders`).set({ Authorization: `Bearer ${heldToken}` });
    expect([blocked.status, blocked.body.error.code]).toEqual([403, 'ACCOUNT_DISABLED']);
    expect((await request(app).get(`${base}/me`).set({ Authorization: `Bearer ${heldToken}` })).status).toBe(403);

    await request(app).post(`${base}/auth/otp/send`).send({ mobile: '9877700051', purpose: 'login' });
    const relogin = await request(app).post(`${base}/auth/otp/verify`).send({ mobile: '9877700051', code: getLastOtpForTesting('9877700051'), purpose: 'login' });
    expect([relogin.status, relogin.body.error.code]).toEqual([403, 'ACCOUNT_DISABLED']);
    expect((await request(app).get(`${base}/rider/orders`).set({ Authorization: `Bearer ${token}` })).status).toBe(200);
  });
});

describe('Riders — assignment, rider app, delivery OTP', () => {
  let admin;
  let adminH;
  let customer;
  let rider;
  let riderH;
  let other; // another rider
  let otherH;
  let product;
  let addressId;

  beforeEach(async () => {
    admin = await createAuthedUser({ role: 'admin' });
    adminH = bearer(admin);
    customer = await createAuthedUser();
    rider = await createAuthedUser({ role: 'rider', mobile: '9877700061', name: 'Rider One' });
    riderH = bearer(rider);
    other = await createAuthedUser({ role: 'rider', mobile: '9877700062', name: 'Rider Two' });
    otherH = bearer(other);
    product = await createProduct(await createCategory(), { price: 8000, mrp: 9000, stock: 200 });
    addressId = (await createAddress(customer.user, { pincode: '261001', landmark: 'Blue gate' }))._id.toString();
    // a location so the rider can find the house
    await request(app).patch(`${base}/addresses/${addressId}`).set(bearer(customer)).send({ location: { lat: 27.57, lng: 80.68 } });
  });

  const assign = (orderId, riderId, h = adminH) => request(app).patch(`${base}/admin/orders/${orderId}/assign`).set(h).send({ riderId });
  const deliver = (orderId, body, h = riderH) => request(app).post(`${base}/rider/orders/${orderId}/deliver`).set(h).send(body);
  const outForDelivery = (orderId, h = riderH) => request(app).patch(`${base}/rider/orders/${orderId}/out-for-delivery`).set(h).send();

  /** customer orders -> admin confirms -> admin assigns `forRider` */
  async function assignedOrder({ paymentMethod = 'cod', forRider = rider, note } = {}) {
    const order = (await placeOrder(app, base, customer, product, addressId, { paymentMethod, deliveryNote: note })).body.data;
    await adminSetStatus(app, base, admin, order.id, 'confirmed');
    await assign(order.id, forRider.user.id);
    return order; // carries deliveryOtp (customer shape)
  }
  const wrongOtp = (otp) => (otp === '0000' ? '1111' : '0000');

  // ------------------------------------------------------------------ assignment
  describe('PATCH /admin/orders/:id/assign', () => {
    it('sets order.rider and returns it populated as { id, name, mobile }', async () => {
      const order = (await placeOrder(app, base, customer, product, addressId)).body.data;
      const res = await assign(order.id, rider.user.id);
      expect(res.status).toBe(200);
      expect(res.body.data.rider).toEqual({ id: rider.user.id, name: 'Rider One', mobile: '9877700061' });
      expect(res.body.data.user).toMatchObject({ name: 'Test Customer' });
      expect((await Order.findById(order.id)).rider.toString()).toBe(rider.user.id);

      // list + detail show the rider; an unassigned order shows null
      const unassigned = (await placeOrder(app, base, customer, product, addressId)).body.data;
      const list = await request(app).get(`${base}/admin/orders`).set(adminH);
      expect(list.body.data.find((o) => o.id === order.id).rider).toEqual({ id: rider.user.id, name: 'Rider One', mobile: '9877700061' });
      expect(list.body.data.find((o) => o.id === unassigned.id).rider).toBeNull();
      expect((await request(app).get(`${base}/admin/orders/${order.id}`).set(adminH)).body.data.rider.name).toBe('Rider One');
    });

    it('can reassign to another rider and unassign with null', async () => {
      const order = await assignedOrder();
      expect((await assign(order.id, other.user.id)).body.data.rider.id).toBe(other.user.id);
      expect((await assign(order.id, null)).body.data.rider).toBeNull();
      expect((await Order.findById(order.id)).rider).toBeNull();
    });

    it('rejects unknown riders, customers, inactive riders, closed orders, bad bodies and non-admins', async () => {
      const order = (await placeOrder(app, base, customer, product, addressId)).body.data;
      const unknown = await assign(order.id, '507f1f77bcf86cd799439011');
      expect([unknown.status, unknown.body.error.code]).toEqual([404, 'RIDER_NOT_FOUND']);
      const asCustomer = await assign(order.id, customer.user.id);
      expect([asCustomer.status, asCustomer.body.error.code]).toEqual([404, 'RIDER_NOT_FOUND']);

      await User.updateOne({ _id: other.user.id }, { isActive: false });
      const inactive = await assign(order.id, other.user.id);
      expect([inactive.status, inactive.body.error.code]).toEqual([400, 'ORDER_NOT_ASSIGNABLE']);

      const missingOrder = await assign('507f1f77bcf86cd799439011', rider.user.id);
      expect([missingOrder.status, missingOrder.body.error.code]).toEqual([404, 'ORDER_NOT_FOUND']);

      await adminSetStatus(app, base, admin, order.id, 'delivered');
      const delivered = await assign(order.id, rider.user.id);
      expect([delivered.status, delivered.body.error.code]).toEqual([400, 'ORDER_NOT_ASSIGNABLE']);
      const cancelledOrder = (await placeOrder(app, base, customer, product, addressId)).body.data;
      await request(app).post(`${base}/orders/${cancelledOrder.id}/cancel`).set(bearer(customer)).send({});
      expect((await assign(cancelledOrder.id, rider.user.id)).body.error.code).toBe('ORDER_NOT_ASSIGNABLE');

      for (const body of [{}, { riderId: 'abc' }, { riderId: rider.user.id, extra: 1 }]) {
        expect([body, (await request(app).patch(`${base}/admin/orders/${order.id}/assign`).set(adminH).send(body)).status]).toEqual([body, 400]);
      }
      expect((await assign(order.id, rider.user.id, bearer(customer))).status).toBe(403);
      expect((await assign(order.id, rider.user.id, riderH)).status).toBe(403);
    });

    it('gives an order that predates delivery OTPs one when it is assigned', async () => {
      const order = (await placeOrder(app, base, customer, product, addressId)).body.data;
      await Order.collection.updateOne({ _id: (await Order.findById(order.id))._id }, { $set: { deliveryOtp: null } });
      expect((await request(app).get(`${base}/orders/${order.id}`).set(bearer(customer))).body.data.deliveryOtp).toBeNull();

      await assign(order.id, rider.user.id);
      expect((await request(app).get(`${base}/orders/${order.id}`).set(bearer(customer))).body.data.deliveryOtp).toMatch(/^\d{4}$/);
    });

    it('shows up in the rider list as activeOrders', async () => {
      await assignedOrder();
      await assignedOrder();
      const res = await request(app).get(`${base}/admin/riders`).set(adminH);
      expect(res.body.data.find((r) => r.id === rider.user.id).activeOrders).toBe(2);
      expect(res.body.data.find((r) => r.id === other.user.id).activeOrders).toBe(0);
    });
  });

  // ------------------------------------------------------------------ rider: list
  describe('GET /rider/orders', () => {
    it('returns only the orders assigned to me, with what is needed to find the house — and no OTP', async () => {
      const mine = await assignedOrder({ note: 'Gate is on the left' });
      await assignedOrder({ forRider: other });
      (await placeOrder(app, base, customer, product, addressId)).body.data; // unassigned

      const res = await request(app).get(`${base}/rider/orders`).set(riderH);
      expect(res.status).toBe(200);
      expect(res.body.data.map((o) => o.id)).toEqual([mine.id]);
      expect(res.body.meta).toMatchObject({ total: 1, page: 1, limit: 20, pages: 1 });

      const o = res.body.data[0];
      expect(o.user).toMatchObject({ name: 'Test Customer', mobile: customer.user.mobile });
      expect(o.shippingAddress).toMatchObject({ pincode: '261001', landmark: 'Blue gate', location: { lat: 27.57, lng: 80.68 } });
      expect(o).toMatchObject({ deliveryNote: 'Gate is on the left', paymentMethod: 'cod', paymentStatus: 'pending', status: 'confirmed' });
      expect(o.pricing.total).toBe(11000);
      expect(JSON.stringify(res.body)).not.toMatch(/deliveryOtp/);
    });

    it('filters by status and paginates; rejects bad params', async () => {
      const a = await assignedOrder();
      await assignedOrder();
      await outForDelivery(a.id);

      const ofd = await request(app).get(`${base}/rider/orders?status=out_for_delivery`).set(riderH);
      expect(ofd.body.data.map((o) => o.id)).toEqual([a.id]);
      expect((await request(app).get(`${base}/rider/orders?status=confirmed`).set(riderH)).body.data).toHaveLength(1);
      expect((await request(app).get(`${base}/rider/orders?limit=1&page=2`).set(riderH)).body.meta).toMatchObject({ total: 2, pages: 2 });
      expect((await request(app).get(`${base}/rider/orders?status=nope`).set(riderH)).status).toBe(400);
      expect((await request(app).get(`${base}/rider/orders?foo=1`).set(riderH)).status).toBe(400);
    });

    it('is for riders only', async () => {
      expect((await request(app).get(`${base}/rider/orders`).set(bearer(customer))).status).toBe(403);
      expect((await request(app).get(`${base}/rider/orders`).set(adminH)).status).toBe(403);
      expect((await request(app).get(`${base}/rider/orders`)).status).toBe(401);
    });
  });

  // ------------------------------------------------------------------ rider: out for delivery
  describe('PATCH /rider/orders/:id/out-for-delivery', () => {
    it('moves a confirmed order out for delivery and logs it', async () => {
      const order = await assignedOrder();
      const res = await outForDelivery(order.id);
      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('out_for_delivery');
      expect(res.body.data.statusHistory.map((s) => s.status)).toEqual(['placed', 'confirmed', 'out_for_delivery']);
      expect(JSON.stringify(res.body)).not.toMatch(/deliveryOtp/);
    });

    it('also accepts packed / shipped, but not placed, already-out or delivered orders', async () => {
      for (const status of ['packed', 'shipped']) {
        const order = await assignedOrder();
        await adminSetStatus(app, base, admin, order.id, status);
        expect((await outForDelivery(order.id)).status).toBe(200);
      }
      const placed = (await placeOrder(app, base, customer, product, addressId)).body.data;
      await assign(placed.id, rider.user.id); // assigned but the store has not confirmed it yet
      const early = await outForDelivery(placed.id);
      expect([early.status, early.body.error.code, early.body.error.details]).toEqual([400, 'INVALID_ORDER_STATE', { status: 'placed' }]);

      const done = await assignedOrder();
      await outForDelivery(done.id);
      expect((await outForDelivery(done.id)).body.error.code).toBe('INVALID_ORDER_STATE');
    });

    it('404s for other riders\' orders, unassigned orders and unknown ids (never leaking which)', async () => {
      const theirs = await assignedOrder({ forRider: other });
      const unassigned = (await placeOrder(app, base, customer, product, addressId)).body.data;
      for (const id of [theirs.id, unassigned.id, '507f1f77bcf86cd799439011']) {
        const res = await outForDelivery(id);
        expect([id, res.status, res.body.error.code]).toEqual([id, 404, 'ORDER_NOT_FOUND']);
      }
      expect((await outForDelivery(theirs.id, bearer(customer))).status).toBe(403);
      expect((await Order.findById(theirs.id)).status).toBe('confirmed'); // untouched
    });
  });

  // ------------------------------------------------------------------ rider: deliver
  describe('POST /rider/orders/:id/deliver', () => {
    it('COD: the right OTP + cash delivers it, marks it paid and records the cash', async () => {
      const order = await assignedOrder();
      await outForDelivery(order.id);

      const res = await deliver(order.id, { otp: order.deliveryOtp, cashCollected: 11000 });
      expect(res.status).toBe(200);
      expect(res.body.data).toMatchObject({ status: 'delivered', paymentStatus: 'paid', cashCollected: 11000 });
      expect(res.body.data.statusHistory.map((s) => s.status)).toEqual(['placed', 'confirmed', 'out_for_delivery', 'delivered']);
      expect(JSON.stringify(res.body)).not.toMatch(/deliveryOtp/);
      expect((await Order.findById(order.id)).status).toBe('delivered');
    });

    it('the delivered order can be reviewed by the customer afterwards (the review gate keys on delivered)', async () => {
      const order = await assignedOrder();
      await outForDelivery(order.id);
      await deliver(order.id, { otp: order.deliveryOtp, cashCollected: 11000 });
      const review = await request(app).post(`${base}/products/${product.id}/reviews`).set(bearer(customer)).send({ rating: 5, comment: 'on time' });
      expect(review.status).toBe(201);
    });

    it('a wrong OTP is 400 INVALID_DELIVERY_OTP with attemptsLeft and changes nothing', async () => {
      const order = await assignedOrder();
      await outForDelivery(order.id);
      const res = await deliver(order.id, { otp: wrongOtp(order.deliveryOtp), cashCollected: 11000 });
      expect([res.status, res.body.error.code]).toEqual([400, 'INVALID_DELIVERY_OTP']);
      expect(res.body.error.details).toEqual({ attemptsLeft: MAX - 1 });
      const stored = await Order.findById(order.id);
      expect(stored).toMatchObject({ status: 'out_for_delivery', paymentStatus: 'pending', cashCollected: null });

      // ...and the right OTP still works afterwards
      expect((await deliver(order.id, { otp: order.deliveryOtp, cashCollected: 11000 })).status).toBe(200);
    });

    it('locks after too many wrong guesses: even the right OTP is refused (429 DELIVERY_OTP_LOCKED); an admin can still close it', async () => {
      const order = await assignedOrder();
      await outForDelivery(order.id);
      for (let i = 1; i <= MAX; i += 1) {
        const res = await deliver(order.id, { otp: wrongOtp(order.deliveryOtp), cashCollected: 11000 });
        expect([i, res.status, res.body.error.details.attemptsLeft]).toEqual([i, 400, MAX - i]);
      }
      const locked = await deliver(order.id, { otp: order.deliveryOtp, cashCollected: 11000 });
      expect([locked.status, locked.body.error.code]).toEqual([429, 'DELIVERY_OTP_LOCKED']);
      expect((await Order.findById(order.id)).status).toBe('out_for_delivery');

      expect((await adminSetStatus(app, base, admin, order.id, 'delivered', 'Closed by store')).status).toBe(200);
    });

    it('the attempt cap holds under parallel guessing (counted atomically)', async () => {
      const order = await assignedOrder();
      await outForDelivery(order.id);
      const results = await Promise.all(
        Array.from({ length: MAX * 2 }, () => deliver(order.id, { otp: wrongOtp(order.deliveryOtp), cashCollected: 11000 }))
      );
      const statuses = results.map((r) => r.status).sort();
      expect(statuses).toEqual([...Array(MAX).fill(400), ...Array(MAX).fill(429)]);
      expect((await Order.findById(order.id)).deliveryOtpAttempts).toBe(MAX);
    });

    it('OTPs with leading zeros work, because the OTP is a string', async () => {
      const order = await assignedOrder();
      await Order.updateOne({ _id: order.id }, { deliveryOtp: '0042' });
      await outForDelivery(order.id);
      expect((await deliver(order.id, { otp: '42', cashCollected: 11000 })).status).toBe(400); // not 4 digits
      expect((await deliver(order.id, { otp: 42, cashCollected: 11000 })).status).toBe(400); // a number would have lost its zeros
      expect((await deliver(order.id, { otp: '0042', cashCollected: 11000 })).status).toBe(200);
    });

    it('COD needs cashCollected (and a missing value does not burn an OTP attempt); a different amount is recorded as reported', async () => {
      const order = await assignedOrder();
      await outForDelivery(order.id);
      const missing = await deliver(order.id, { otp: order.deliveryOtp });
      expect([missing.status, missing.body.error.code]).toEqual([400, 'VALIDATION_ERROR']);
      expect((await Order.findById(order.id)).deliveryOtpAttempts).toBe(0);

      const short = await deliver(order.id, { otp: order.deliveryOtp, cashCollected: 10000 });
      expect(short.status).toBe(200);
      expect(short.body.data.cashCollected).toBe(10000); // 1000 paise short: visible in the COD report
    });

    it('already-paid online orders need no cash: delivered with cashCollected null, paymentStatus stays paid', async () => {
      const order = await assignedOrder({ paymentMethod: 'upi' });
      await request(app)
        .post(`${base}/payments/webhook`)
        .set('x-webhook-signature', 'sig')
        .send({ payload: { payment: { entity: { id: 'pay_R1', order_id: order.paymentProviderOrderId, status: 'captured' } } } });
      await outForDelivery(order.id);

      const withCash = await deliver(order.id, { otp: order.deliveryOtp, cashCollected: 5000 });
      expect([withCash.status, withCash.body.error.code]).toEqual([400, 'VALIDATION_ERROR']);
      const res = await deliver(order.id, { otp: order.deliveryOtp });
      expect(res.status).toBe(200);
      expect(res.body.data).toMatchObject({ status: 'delivered', paymentStatus: 'paid', cashCollected: null });
    });

    it('state, ownership and shape errors', async () => {
      const order = await assignedOrder();
      const early = await deliver(order.id, { otp: order.deliveryOtp, cashCollected: 11000 }); // not out for delivery yet
      expect([early.status, early.body.error.code]).toEqual([400, 'INVALID_ORDER_STATE']);

      await outForDelivery(order.id);
      const wrongRider = await deliver(order.id, { otp: order.deliveryOtp, cashCollected: 11000 }, otherH);
      expect([wrongRider.status, wrongRider.body.error.code]).toEqual([404, 'ORDER_NOT_FOUND']);
      expect((await deliver(order.id, { otp: order.deliveryOtp, cashCollected: 11000 }, bearer(customer))).status).toBe(403);

      for (const body of [{}, { otp: order.deliveryOtp, cashCollected: -1 }, { otp: order.deliveryOtp, cashCollected: 10.5 }, { otp: order.deliveryOtp, cashCollected: '11000' }, { otp: order.deliveryOtp, cashCollected: 11000, extra: 1 }]) {
        expect([body, (await deliver(order.id, body)).status]).toEqual([body, 400]);
      }
      expect((await Order.findById(order.id)).status).toBe('out_for_delivery');

      expect((await deliver(order.id, { otp: order.deliveryOtp, cashCollected: 11000 })).status).toBe(200);
      const again = await deliver(order.id, { otp: order.deliveryOtp, cashCollected: 11000 });
      expect([again.status, again.body.error.code]).toEqual([400, 'INVALID_ORDER_STATE']); // cannot deliver twice
    });

    it('a reassigned order disappears from the old rider', async () => {
      const order = await assignedOrder();
      await outForDelivery(order.id);
      await assign(order.id, other.user.id);
      expect((await deliver(order.id, { otp: order.deliveryOtp, cashCollected: 11000 })).status).toBe(404);
      expect((await deliver(order.id, { otp: order.deliveryOtp, cashCollected: 11000 }, otherH)).status).toBe(200);
    });
  });
});
