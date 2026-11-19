import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { env } from '../src/config/env.js';
import { Order } from '../src/models/Order.js';
import { Product } from '../src/models/Product.js';
import { Coupon } from '../src/models/Coupon.js';
import { CouponRedemption } from '../src/models/CouponRedemption.js';
import { getPaymentProvider } from '../src/services/payment.service.js';
import { createAuthedUser, createCategory, createProduct, createAddress, bearer, adminSetStatus } from './helpers.js';

const app = createApp();
const base = env.apiBasePath;
const DAY = 24 * 3600 * 1000;

describe('Cancellation (stock, coupon) and refunds', () => {
  let admin;
  let adminH;
  let customer;
  let h;
  let address;
  let category;
  let keySeq = 0;

  beforeEach(async () => {
    admin = await createAuthedUser({ role: 'admin' });
    adminH = bearer(admin);
    customer = await createAuthedUser();
    h = bearer(customer);
    address = await createAddress(customer.user);
    category = await createCategory();
  });

  const addToCart = (productId, qty = 1, variantId, who = h) =>
    request(app).post(`${base}/cart/items`).set(who).send({ productId, qty, ...(variantId ? { variantId } : {}) });
  const checkout = (paymentMethod = 'cod', who = h, addr = address) =>
    request(app).post(`${base}/orders`).set(who).set('Idempotency-Key', `cr-${(keySeq += 1)}`).send({ addressId: addr._id.toString(), paymentMethod });
  const orderOf = async (product, { qty = 1, paymentMethod = 'cod' } = {}) => {
    await addToCart(product.id, qty);
    const res = await checkout(paymentMethod);
    expect(res.status).toBe(201);
    return res.body.data;
  };
  /** An online (upi) order that was paid (mock gateway). */
  const paidOrder = async (product, qty = 1) => {
    const order = await orderOf(product, { qty, paymentMethod: 'upi' });
    const paid = await request(app).post(`${base}/payments/verify`).set(h).send({ orderId: order.id, razorpay_payment_id: `pay_${order.orderNumber}`, razorpay_signature: 'sig' });
    expect(paid.body.data.paymentStatus).toBe('paid');
    return paid.body.data;
  };
  const adminCancel = (id, note) => adminSetStatus(app, base, admin, id, 'cancelled', note);
  const customerCancel = (id, who = h) => request(app).post(`${base}/orders/${id}/cancel`).set(who).send({});
  const stockOf = async (product) => (await Product.findById(product.id)).stock;
  const refundWebhook = (event, entity, signature = 'sig') =>
    request(app)
      .post(`${base}/payments/webhook`)
      .set('x-razorpay-signature', signature)
      .set('Content-Type', 'application/json')
      .send(JSON.stringify({ event, payload: { refund: { entity } } }));
  const adminRefund = (id, body, who = adminH) => request(app).post(`${base}/admin/orders/${id}/refund`).set(who).send(body);

  // ================================================================== stock + coupon on ADMIN cancel
  describe('PATCH /admin/orders/:id/status -> "cancelled"', () => {
    it('puts the stock back, like a customer cancel, and records the reason in the history', async () => {
      const product = await createProduct(category, { stock: 20 });
      const order = await orderOf(product, { qty: 3 });
      expect(await stockOf(product)).toBe(17);

      const res = await adminCancel(order.id, 'Customer called to cancel');
      expect(res.status).toBe(200);
      expect(res.body.data).toMatchObject({ status: 'cancelled', cancelReason: 'Customer called to cancel' });
      expect(res.body.data.statusHistory.at(-1)).toMatchObject({ status: 'cancelled', note: 'Customer called to cancel' });
      expect(await stockOf(product)).toBe(20);
    });

    it('a customer cancel and an admin cancel leave identical stock', async () => {
      const a = await createProduct(category, { stock: 10 });
      const b = await createProduct(category, { stock: 10 });
      const byCustomer = await orderOf(a, { qty: 2 });
      const byAdmin = await orderOf(b, { qty: 2 });
      await customerCancel(byCustomer.id);
      await adminCancel(byAdmin.id);
      expect([await stockOf(a), await stockOf(b)]).toEqual([10, 10]);
    });

    it('goes back into the SAME variant (and the product total), not another one', async () => {
      const product = await createProduct(category, {
        optionName: { en: 'Pack size', hi: 'पैक साइज़' },
        variants: [
          { label: { en: '1 kg', hi: '1 किलो' }, mrp: 6000, price: 5000, stock: 20, isDefault: true },
          { label: { en: '5 kg', hi: '5 किलो' }, mrp: 27500, price: 24900, stock: 10 },
        ],
      });
      const [v1, v5] = product.variants;
      await addToCart(product.id, 4, v5.id);
      await addToCart(product.id, 2, v1.id);
      const order = (await checkout()).body.data;
      let stored = await Product.findById(product.id);
      expect([stored.variants[0].stock, stored.variants[1].stock, stored.stock]).toEqual([18, 6, 24]);

      await adminCancel(order.id);
      stored = await Product.findById(product.id);
      expect([stored.variants[0].stock, stored.variants[1].stock, stored.stock]).toEqual([20, 10, 30]);
    });

    it('is idempotent: cancelling twice (also at the same moment) restores the stock only once', async () => {
      const product = await createProduct(category, { stock: 10 });
      const order = await orderOf(product, { qty: 4 });
      expect(await stockOf(product)).toBe(6);

      const first = await adminCancel(order.id);
      const second = await adminCancel(order.id, 'again');
      expect([first.status, second.status]).toEqual([200, 200]);
      expect(second.body.data.cancelReason).toBe('Cancelled by admin'); // the first cancel's reason stands
      expect(second.body.data.statusHistory.filter((s) => s.status === 'cancelled')).toHaveLength(1);
      expect(await stockOf(product)).toBe(10);

      const other = await orderOf(product, { qty: 4 });
      const both = await Promise.all([adminCancel(other.id), adminCancel(other.id), customerCancel(other.id)]);
      expect(both.slice(0, 2).map((r) => r.status)).toEqual([200, 200]);
      expect(await stockOf(product)).toBe(10); // not 14 or 18
    });

    it('a cancel by the customer and by the admin racing each other still restores once', async () => {
      const product = await createProduct(category, { stock: 10 });
      const order = await orderOf(product, { qty: 5 });
      await Promise.all([customerCancel(order.id), adminCancel(order.id)]);
      expect(await stockOf(product)).toBe(10);
      expect((await Order.findById(order.id)).statusHistory.filter((s) => s.status === 'cancelled')).toHaveLength(1);
    });

    it('a cancelled order cannot be re-opened (400 INVALID_ORDER_STATE); the customer cannot cancel it again', async () => {
      const product = await createProduct(category, { stock: 10 });
      const order = await orderOf(product);
      await adminCancel(order.id);
      const reopen = await adminSetStatus(app, base, admin, order.id, 'confirmed');
      expect([reopen.status, reopen.body.error.code]).toEqual([400, 'INVALID_ORDER_STATE']);
      expect((await customerCancel(order.id)).body.error.code).toBe('ORDER_NOT_CANCELLABLE');
      expect((await Order.findById(order.id)).status).toBe('cancelled');
    });

    it('404 for an unknown order; other transitions are unchanged', async () => {
      expect((await adminCancel('507f1f77bcf86cd799439011')).status).toBe(404);
      const product = await createProduct(category, { stock: 10 });
      const order = await orderOf(product);
      expect((await adminSetStatus(app, base, admin, order.id, 'confirmed')).body.data.status).toBe('confirmed');
      expect(await stockOf(product)).toBe(9);
    });

    it('admin cancelling an order that is out for delivery still restores (an admin decision)', async () => {
      const product = await createProduct(category, { stock: 10 });
      const order = await orderOf(product, { qty: 2 });
      await adminSetStatus(app, base, admin, order.id, 'out_for_delivery');
      expect((await adminCancel(order.id)).status).toBe(200);
      expect(await stockOf(product)).toBe(10);
    });
  });

  // ================================================================== coupon redemption comes back
  describe('coupon redemption', () => {
    const makeCoupon = (over = {}) =>
      Coupon.create({
        code: 'SAVE50',
        type: 'flat',
        value: 5000,
        minOrderValue: 10000,
        startsAt: new Date(Date.now() - DAY),
        expiresAt: new Date(Date.now() + 10 * DAY),
        usageLimit: 5,
        perUserLimit: 1,
        isActive: true,
        ...over,
      });
    const withCoupon = async (product) => {
      await addToCart(product.id, 1);
      expect((await request(app).post(`${base}/cart/coupon`).set(h).send({ code: 'SAVE50' })).status).toBe(200);
      const res = await checkout();
      expect(res.body.data.couponCode).toBe('SAVE50');
      return res.body.data;
    };

    for (const [who, cancel] of [['customer', (id) => customerCancel(id)], ['admin', (id) => adminCancel(id)]]) {
      it(`${who} cancel: usedCount goes down, the redemption is deleted and the per-user limit is free again`, async () => {
        await makeCoupon();
        const product = await createProduct(category, { price: 25000, mrp: 30000, stock: 10 });
        const order = await withCoupon(product);
        expect((await Coupon.findOne({ code: 'SAVE50' })).usedCount).toBe(1);
        expect(await CouponRedemption.countDocuments({ order: order.id })).toBe(1);

        // while the order stands the per-user limit (1) blocks a second use
        await addToCart(product.id, 1);
        expect((await request(app).post(`${base}/cart/coupon`).set(h).send({ code: 'SAVE50' })).body.error.code).toBe('COUPON_PER_USER_LIMIT_REACHED');
        await request(app).delete(`${base}/cart`).set(h);

        expect((await cancel(order.id)).status).toBe(200);
        expect((await Coupon.findOne({ code: 'SAVE50' })).usedCount).toBe(0);
        expect(await CouponRedemption.countDocuments({ order: order.id })).toBe(0);

        await addToCart(product.id, 1);
        expect((await request(app).post(`${base}/cart/coupon`).set(h).send({ code: 'SAVE50' })).status).toBe(200); // usable again
      });
    }

    it('gives a slot back to a usage-limited coupon, once, even if cancelled twice', async () => {
      await makeCoupon({ usageLimit: 1, perUserLimit: 5 });
      const product = await createProduct(category, { price: 25000, mrp: 30000, stock: 10 });
      const order = await withCoupon(product);
      expect((await Coupon.findOne({ code: 'SAVE50' })).usedCount).toBe(1);

      await adminCancel(order.id);
      await adminCancel(order.id);
      expect((await Coupon.findOne({ code: 'SAVE50' })).usedCount).toBe(0); // 0, not -1

      const someone = await createAuthedUser();
      await addToCart(product.id, 1, undefined, bearer(someone));
      expect((await request(app).post(`${base}/cart/coupon`).set(bearer(someone)).send({ code: 'SAVE50' })).status).toBe(200);
    });

    it('an order without a coupon cancels fine and touches no coupon', async () => {
      await makeCoupon();
      const product = await createProduct(category, { stock: 10 });
      const order = await orderOf(product);
      expect((await adminCancel(order.id)).status).toBe(200);
      expect((await Coupon.findOne({ code: 'SAVE50' })).usedCount).toBe(0);
    });
  });

  // ================================================================== refunds
  describe('refund when a paid online order is cancelled', () => {
    for (const [who, cancel] of [['customer', (id) => customerCancel(id)], ['admin', (id) => adminCancel(id)]]) {
      it(`${who} cancel: the gateway refunds the full amount; paymentStatus becomes "refunded" once it is processed (mock: at once)`, async () => {
        const product = await createProduct(category, { stock: 10 });
        const order = await paidOrder(product, 2);
        const total = order.pricing.total;
        expect(order).toMatchObject({ refundStatus: null, refundId: null, refundedAmount: 0, refundedAt: null, refunds: [] });

        const res = await cancel(order.id);
        expect(res.status).toBe(200);
        expect(res.body.data).toMatchObject({
          status: 'cancelled',
          paymentStatus: 'refunded',
          refundStatus: 'processed',
          refundId: expect.stringMatching(/^rfnd_mock_/),
          refundedAmount: total,
          refundedAt: expect.any(String),
        });
        expect(res.body.data.refunds).toEqual([
          {
            id: expect.any(String),
            refundId: res.body.data.refundId,
            amount: total,
            status: 'processed',
            reason: expect.any(String),
            source: 'cancel',
            failureReason: null,
            createdAt: expect.any(String),
            processedAt: expect.any(String),
          },
        ]);
        expect(await stockOf(product)).toBe(10);

        // the customer and the admin read the same fields
        const mine = await request(app).get(`${base}/orders/${order.id}`).set(h);
        expect(mine.body.data).toMatchObject({ refundStatus: 'processed', refundedAmount: total, paymentStatus: 'refunded' });
        const adminView = await request(app).get(`${base}/admin/orders/${order.id}`).set(adminH);
        expect(adminView.body.data).toMatchObject({ refundStatus: 'processed', refundedAmount: total, refundId: res.body.data.refundId });
        expect(adminView.body.data.refunds).toHaveLength(1);
      });
    }

    it('no refund for COD, unpaid online, or already-failed payments; paid COD is only marked refunded (cash goes back by hand)', async () => {
      const product = await createProduct(category, { stock: 20 });
      const spy = jest.spyOn(getPaymentProvider(), 'refund');
      try {
        const cod = await orderOf(product);
        const unpaid = await orderOf(product, { paymentMethod: 'upi' });
        const codPaid = await orderOf(product);
        await Order.updateOne({ _id: codPaid.id }, { paymentStatus: 'paid' }); // the rider collected the cash

        for (const o of [cod, unpaid]) {
          const res = await adminCancel(o.id);
          expect(res.body.data).toMatchObject({ status: 'cancelled', refundStatus: null, refundedAmount: 0, refunds: [] });
        }
        expect((await Order.findById(cod.id)).paymentStatus).toBe('pending');
        expect((await Order.findById(unpaid.id)).paymentStatus).toBe('pending');

        const res = await customerCancel(codPaid.id);
        expect(res.body.data).toMatchObject({ paymentStatus: 'refunded', refundStatus: null, refunds: [] });
        expect(spy).not.toHaveBeenCalled();
      } finally {
        spy.mockRestore();
      }
    });

    it('a gateway failure never undoes the cancellation: stock is back, refundStatus "failed", paymentStatus stays "paid"; an admin can retry', async () => {
      const product = await createProduct(category, { stock: 10 });
      const order = await paidOrder(product);
      const spy = jest.spyOn(getPaymentProvider(), 'refund').mockRejectedValueOnce(new Error('gateway timeout'));
      try {
        const res = await customerCancel(order.id);
        expect(res.status).toBe(200);
        expect(res.body.data).toMatchObject({ status: 'cancelled', paymentStatus: 'paid', refundStatus: 'failed', refundedAmount: 0, refundedAt: null });
        expect(res.body.data.refunds).toEqual([expect.objectContaining({ status: 'failed', failureReason: 'gateway timeout', amount: order.pricing.total })]);
        expect(await stockOf(product)).toBe(10);
      } finally {
        spy.mockRestore();
      }

      const retry = await adminRefund(order.id, { reason: 'Retry after the gateway failure' });
      expect(retry.status).toBe(200);
      expect(retry.body.data).toMatchObject({ paymentStatus: 'refunded', refundStatus: 'processed', refundedAmount: order.pricing.total });
      expect(retry.body.data.refunds.map((r) => r.status)).toEqual(['failed', 'processed']);
    });

    it('Razorpay style: starts "pending" (paymentStatus stays paid) and finishes with the refund.processed webhook — replays change nothing', async () => {
      const product = await createProduct(category, { stock: 10 });
      const order = await paidOrder(product);
      const spy = jest.spyOn(getPaymentProvider(), 'refund').mockResolvedValue({ id: 'rfnd_RZP1', amount: order.pricing.total, status: 'pending' });
      try {
        const res = await adminCancel(order.id);
        expect(res.body.data).toMatchObject({ paymentStatus: 'paid', refundStatus: 'pending', refundId: 'rfnd_RZP1', refundedAmount: 0, refundedAt: null });

        const hook = await refundWebhook('refund.processed', { id: 'rfnd_RZP1', payment_id: `pay_${order.orderNumber}`, amount: order.pricing.total, status: 'processed' });
        expect(hook.body).toEqual({ success: true, data: { received: true, matched: true }, error: null });
        const done = await Order.findById(order.id);
        expect(done).toMatchObject({ paymentStatus: 'refunded', refundStatus: 'processed', refundId: 'rfnd_RZP1', refundedAmount: order.pricing.total });
        expect(done.refundedAt).toBeInstanceOf(Date);

        const firstProcessedAt = done.refunds[0].processedAt.getTime();
        await new Promise((r) => setTimeout(r, 15));
        await refundWebhook('refund.processed', { id: 'rfnd_RZP1', payment_id: `pay_${order.orderNumber}`, amount: order.pricing.total, status: 'processed' });
        await refundWebhook('refund.failed', { id: 'rfnd_RZP1', payment_id: `pay_${order.orderNumber}`, amount: order.pricing.total, status: 'failed' }); // too late: it is final
        const again = await Order.findById(order.id);
        expect(again.refunds).toHaveLength(1);
        expect([again.refundStatus, again.refundedAmount, again.paymentStatus]).toEqual(['processed', order.pricing.total, 'refunded']);
        expect(again.refunds[0].processedAt.getTime()).toBe(firstProcessedAt);
      } finally {
        spy.mockRestore();
      }
    });

    it('refund.failed marks it failed, keeps the order "paid" and frees the amount for another try', async () => {
      const product = await createProduct(category, { stock: 10 });
      const order = await paidOrder(product);
      const spy = jest.spyOn(getPaymentProvider(), 'refund').mockResolvedValue({ id: 'rfnd_FAIL', amount: order.pricing.total, status: 'pending' });
      try {
        await adminCancel(order.id);
        await refundWebhook('refund.failed', { id: 'rfnd_FAIL', payment_id: `pay_${order.orderNumber}`, amount: order.pricing.total, status: 'failed' });
        const failed = await Order.findById(order.id);
        expect([failed.paymentStatus, failed.refundStatus, failed.refundedAmount]).toEqual(['paid', 'failed', 0]);

        spy.mockResolvedValue({ id: 'rfnd_OK', amount: order.pricing.total, status: 'processed' });
        const retry = await adminRefund(order.id, { reason: 'second try' });
        expect(retry.body.data).toMatchObject({ paymentStatus: 'refunded', refundStatus: 'processed', refundId: 'rfnd_OK' });
      } finally {
        spy.mockRestore();
      }
    });

    it('a webhook that arrives BEFORE we stored the gateway id still lands on the right refund', async () => {
      const product = await createProduct(category, { stock: 10 });
      const order = await paidOrder(product);
      const spy = jest.spyOn(getPaymentProvider(), 'refund').mockImplementation(async ({ amountPaise }) => {
        // the gateway processes it and calls us back before the refund() call has even returned
        await refundWebhook('refund.processed', { id: 'rfnd_FAST', payment_id: `pay_${order.orderNumber}`, amount: amountPaise, status: 'processed' });
        return { id: 'rfnd_FAST', amount: amountPaise, status: 'pending' };
      });
      try {
        const res = await customerCancel(order.id);
        expect(res.body.data).toMatchObject({ paymentStatus: 'refunded', refundStatus: 'processed', refundId: 'rfnd_FAST', refundedAmount: order.pricing.total });
        expect(res.body.data.refunds).toHaveLength(1); // adopted, not duplicated
      } finally {
        spy.mockRestore();
      }
    });

    it('a refund made outside the API (e.g. the Razorpay dashboard) is recorded from its webhook', async () => {
      const product = await createProduct(category, { stock: 10 });
      const order = await paidOrder(product, 2);
      const half = Math.floor(order.pricing.total / 2);
      const hook = await refundWebhook('refund.processed', { id: 'rfnd_DASH', payment_id: `pay_${order.orderNumber}`, amount: half, status: 'processed' });
      expect(hook.body.data.matched).toBe(true);
      const stored = await Order.findById(order.id);
      expect(stored.refunds).toHaveLength(1);
      expect(stored.refunds[0]).toMatchObject({ refundId: 'rfnd_DASH', amount: half, status: 'processed', source: 'gateway' });
      expect([stored.refundedAmount, stored.paymentStatus]).toEqual([half, 'paid']);
      await refundWebhook('refund.processed', { id: 'rfnd_DASH', payment_id: `pay_${order.orderNumber}`, amount: half, status: 'processed' }); // replay
      expect((await Order.findById(order.id)).refunds).toHaveLength(1);
    });

    it('the webhook is signed like the payment webhook, answers 200 for unknown refunds and ignores other refund events', async () => {
      const unsigned = await request(app).post(`${base}/payments/webhook`).set('Content-Type', 'application/json').send(JSON.stringify({ event: 'refund.processed', payload: { refund: { entity: { id: 'x', payment_id: 'p', amount: 1 } } } }));
      expect([unsigned.status, unsigned.body.error.code]).toEqual([400, 'PAYMENT_SIGNATURE_INVALID']);
      const unknown = await refundWebhook('refund.processed', { id: 'rfnd_NOBODY', payment_id: 'pay_nobody', amount: 100, status: 'processed' });
      expect(unknown.body.data).toEqual({ received: true, matched: false });
      const created = await refundWebhook('refund.created', { id: 'rfnd_X', payment_id: 'pay_x', amount: 100 });
      expect(created.body.data).toEqual({ received: true, matched: false });
    });
  });

  // ================================================================== POST /admin/orders/:id/refund
  describe('POST /admin/orders/:id/refund', () => {
    it('partial refund of a paid online order: the order keeps being paid, refundedAmount grows, amounts add up', async () => {
      const product = await createProduct(category, { stock: 10, price: 8000, mrp: 10000 });
      const order = await paidOrder(product, 2); // 16000 + fees
      const total = order.pricing.total;

      const first = await adminRefund(order.id, { amount: 3000, reason: 'One item was missing' });
      expect(first.status).toBe(200);
      expect(first.body.data).toMatchObject({ id: order.id, status: 'confirmed', paymentStatus: 'paid', refundStatus: 'processed', refundedAmount: 3000 });
      expect(first.body.data.user).toEqual(expect.objectContaining({ mobile: customer.user.mobile })); // admin shape
      expect(first.body.data.refunds).toEqual([expect.objectContaining({ amount: 3000, status: 'processed', reason: 'One item was missing', source: 'admin' })]);
      expect(first.body.data.deliveryOtp).toBeUndefined();

      const second = await adminRefund(order.id, { amount: 2000, reason: 'Damaged' });
      expect(second.body.data).toMatchObject({ refundedAmount: 5000, paymentStatus: 'paid' });
      expect(second.body.data.refunds.map((r) => r.amount)).toEqual([3000, 2000]);

      const rest = await adminRefund(order.id, { reason: 'Refund the rest' }); // no amount = everything left
      expect(rest.body.data).toMatchObject({ refundedAmount: total, paymentStatus: 'refunded', refundStatus: 'processed' });
      expect(rest.body.data.refunds.map((r) => r.amount)).toEqual([3000, 2000, total - 5000]);

      const more = await adminRefund(order.id, { reason: 'one more' });
      expect([more.status, more.body.error.code]).toEqual([400, 'REFUND_NOT_ALLOWED']);
    });

    it('never refunds more than was paid: 400 REFUND_AMOUNT_EXCEEDED with details.maxRefundable', async () => {
      const product = await createProduct(category, { stock: 10 });
      const order = await paidOrder(product);
      const total = order.pricing.total;

      const tooMuch = await adminRefund(order.id, { amount: total + 1, reason: 'oops' });
      expect([tooMuch.status, tooMuch.body.error.code]).toEqual([400, 'REFUND_AMOUNT_EXCEEDED']);
      expect(tooMuch.body.error.details).toEqual({ maxRefundable: total, paid: total });

      await adminRefund(order.id, { amount: total - 1000, reason: 'most of it' });
      const over = await adminRefund(order.id, { amount: 1001, reason: 'a bit too much' });
      expect(over.body.error.details.maxRefundable).toBe(1000);
      expect((await adminRefund(order.id, { amount: 1000, reason: 'exactly the rest' })).body.data.paymentStatus).toBe('refunded');
      expect((await Order.findById(order.id)).refundedAmount).toBe(total);
    });

    it('two simultaneous refunds can never add up to more than the paid amount', async () => {
      const product = await createProduct(category, { stock: 10 });
      const order = await paidOrder(product);
      const amount = Math.ceil(order.pricing.total * 0.6);
      const results = await Promise.all([adminRefund(order.id, { amount, reason: 'a' }), adminRefund(order.id, { amount, reason: 'b' }), adminRefund(order.id, { amount, reason: 'c' })]);
      expect(results.map((r) => r.status).sort()).toEqual([200, 400, 400]);
      const stored = await Order.findById(order.id);
      expect(stored.refundedAmount).toBe(amount);
      expect(stored.refunds.filter((r) => r.status !== 'failed')).toHaveLength(1);
    });

    it('a pending refund still counts against the paid amount', async () => {
      const product = await createProduct(category, { stock: 10 });
      const order = await paidOrder(product);
      const spy = jest.spyOn(getPaymentProvider(), 'refund').mockResolvedValue({ id: 'rfnd_P1', amount: 1000, status: 'pending' });
      try {
        await adminRefund(order.id, { amount: order.pricing.total - 500, reason: 'big one' });
        const over = await adminRefund(order.id, { amount: 600, reason: 'too much while the first is pending' });
        expect([over.status, over.body.error.details.maxRefundable]).toEqual([400, 500]);
        const stored = await Order.findById(order.id);
        expect([stored.refundStatus, stored.refundedAmount, stored.paymentStatus]).toEqual(['pending', 0, 'paid']);
      } finally {
        spy.mockRestore();
      }
    });

    it('a gateway error answers 502 REFUND_PROVIDER_ERROR, marks the attempt failed and frees the amount', async () => {
      const product = await createProduct(category, { stock: 10 });
      const order = await paidOrder(product);
      const spy = jest.spyOn(getPaymentProvider(), 'refund').mockRejectedValueOnce(new Error('boom'));
      try {
        const res = await adminRefund(order.id, { amount: 1000, reason: 'try' });
        expect([res.status, res.body.error.code]).toEqual([502, 'REFUND_PROVIDER_ERROR']);
      } finally {
        spy.mockRestore();
      }
      const stored = await Order.findById(order.id);
      expect([stored.refundStatus, stored.refundedAmount, stored.paymentStatus]).toEqual(['failed', 0, 'paid']);
      expect((await adminRefund(order.id, { amount: 1000, reason: 'again' })).body.data.refundedAmount).toBe(1000);
    });

    it('only for paid ONLINE orders: COD, unpaid and unknown orders are refused', async () => {
      const product = await createProduct(category, { stock: 20 });
      const cod = await orderOf(product);
      await Order.updateOne({ _id: cod.id }, { paymentStatus: 'paid' });
      const unpaid = await orderOf(product, { paymentMethod: 'upi' });
      for (const [label, id] of [['cod', cod.id], ['unpaid online', unpaid.id]]) {
        const res = await adminRefund(id, { reason: 'x' });
        expect([label, res.status, res.body.error.code]).toEqual([label, 400, 'REFUND_NOT_ALLOWED']);
      }
      expect((await adminRefund('507f1f77bcf86cd799439011', { reason: 'x' })).status).toBe(404);
    });

    it('works on a delivered order too (e.g. a missing item found afterwards)', async () => {
      const product = await createProduct(category, { stock: 10 });
      const order = await paidOrder(product);
      await adminSetStatus(app, base, admin, order.id, 'delivered');
      const res = await adminRefund(order.id, { amount: 1500, reason: 'Missing item' });
      expect(res.body.data).toMatchObject({ status: 'delivered', refundedAmount: 1500, paymentStatus: 'paid' });
    });

    it('validates the body (strict): reason required, amount a positive whole number of paise, no extra keys', async () => {
      const product = await createProduct(category, { stock: 10 });
      const order = await paidOrder(product);
      for (const [label, body] of [
        ['no reason', { amount: 100 }],
        ['empty reason', { reason: '' }],
        ['long reason', { reason: 'x'.repeat(201) }],
        ['zero', { amount: 0, reason: 'x' }],
        ['negative', { amount: -5, reason: 'x' }],
        ['decimal', { amount: 10.5, reason: 'x' }],
        ['string', { amount: '100', reason: 'x' }],
        ['extra', { amount: 100, reason: 'x', speed: 'instant' }],
      ]) {
        const res = await adminRefund(order.id, body);
        expect([label, res.status, res.body.error.code]).toEqual([label, 400, 'VALIDATION_ERROR']);
      }
      expect((await adminRefund('nope', { reason: 'x' })).status).toBe(400);
      expect((await Order.findById(order.id)).refunds).toHaveLength(0);
    });

    it('is admin-only', async () => {
      const product = await createProduct(category, { stock: 10 });
      const order = await paidOrder(product);
      expect((await adminRefund(order.id, { reason: 'x' }, h)).status).toBe(403);
      expect((await adminRefund(order.id, { reason: 'x' }, bearer(await createAuthedUser({ role: 'rider' })))).status).toBe(403);
      expect((await adminRefund(order.id, { reason: 'x' }, {})).status).toBe(401);
      expect((await Order.findById(order.id)).refunds).toHaveLength(0);
    });
  });

  // ================================================================== old data + reports
  describe('orders from before refunds existed', () => {
    it('read as "no refund" and cancel exactly as before', async () => {
      const product = await createProduct(category, { stock: 10 });
      const order = await orderOf(product, { qty: 2 });
      await Order.collection.updateOne(
        { _id: (await Order.findById(order.id))._id },
        { $unset: { refundStatus: '', refundId: '', refundedAmount: '', refundedAt: '', refunds: '' } }
      );
      const read = await request(app).get(`${base}/orders/${order.id}`).set(h);
      expect(read.body.data).toMatchObject({ refundStatus: null, refundId: null, refundedAmount: 0, refundedAt: null, refunds: [] });
      expect((await customerCancel(order.id)).status).toBe(200);
      expect(await stockOf(product)).toBe(10);
    });

    it('a fully refunded online order is out of the revenue numbers (cancelled anyway)', async () => {
      const product = await createProduct(category, { stock: 10 });
      const order = await paidOrder(product);
      await adminCancel(order.id);
      const stats = await request(app).get(`${base}/admin/stats`).set(adminH);
      expect(stats.body.data).toMatchObject({ todayOrders: 0, todayRevenue: 0 });
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });
});
