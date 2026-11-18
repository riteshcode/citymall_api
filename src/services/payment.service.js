import crypto from 'crypto';
import { env } from '../config/env.js';
import { logger } from '../config/logger.js';
import { Order } from '../models/Order.js';
import { ApiError } from '../utils/ApiError.js';
import { ErrorCodes } from '../utils/errorCodes.js';

/**
 * PaymentProvider interface every provider implements:
 *   createOrder({ amountPaise, currency, receipt }): Promise<{ id, amount, currency, status }>
 *   verifySignature({ rawBody, signature }): boolean              // webhook (HMAC over raw body, webhook secret)
 *   verifyPaymentSignature({ providerOrderId, paymentId, signature }): boolean   // checkout callback
 */

const safeEqualHex = (expected, actual) => {
  const a = Buffer.from(expected);
  const b = Buffer.from(String(actual));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
};

const mockProvider = {
  async createOrder({ amountPaise, currency = 'INR', receipt }) {
    const id = `order_mock_${crypto.randomBytes(8).toString('hex')}`;
    logger.info(`[Payments:mock] created order ${id} for ${amountPaise} paise (receipt=${receipt})`);
    return { id, amount: amountPaise, currency, status: 'created' };
  },

  // Dev/test only: any non-empty signature passes so the flow can be exercised without a gateway.
  // Hard-disabled in production — otherwise anyone could mark their own order "paid" for free.
  verifySignature({ signature }) {
    return !env.isProd && Boolean(signature);
  },
  verifyPaymentSignature({ signature }) {
    return !env.isProd && Boolean(signature);
  },
};

const razorpayProvider = {
  /** Real Razorpay Orders API call (https://razorpay.com/docs/api/orders/create/). amount is in paise. */
  async createOrder({ amountPaise, currency = 'INR', receipt }) {
    const { razorpayKeyId, razorpayKeySecret } = env.payments;
    if (!razorpayKeyId || !razorpayKeySecret) {
      throw new ApiError(503, ErrorCodes.PAYMENT_PROVIDER_ERROR, 'Online payments are not configured');
    }

    let res;
    try {
      res = await fetch('https://api.razorpay.com/v1/orders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Basic ${Buffer.from(`${razorpayKeyId}:${razorpayKeySecret}`).toString('base64')}`,
        },
        body: JSON.stringify({ amount: amountPaise, currency, receipt }),
        signal: AbortSignal.timeout(10_000),
      });
    } catch (err) {
      logger.error(`[Payments:razorpay] request failed: ${err.message}`);
      throw new ApiError(502, ErrorCodes.PAYMENT_PROVIDER_ERROR, 'Could not reach the payment provider, please retry');
    }

    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      logger.error(`[Payments:razorpay] create order failed ${res.status}: ${body?.error?.description}`);
      throw new ApiError(502, ErrorCodes.PAYMENT_PROVIDER_ERROR, 'Could not create the payment, please retry');
    }
    return { id: body.id, amount: body.amount, currency: body.currency, status: body.status };
  },

  /** Webhook signature = HMAC-SHA256(rawBody, webhookSecret), hex. */
  verifySignature({ rawBody, signature }) {
    if (!signature) return false;
    const expected = crypto.createHmac('sha256', env.payments.webhookSecret).update(rawBody).digest('hex');
    return safeEqualHex(expected, signature);
  },

  /** Checkout callback signature = HMAC-SHA256(`${razorpay_order_id}|${razorpay_payment_id}`, keySecret), hex. */
  verifyPaymentSignature({ providerOrderId, paymentId, signature }) {
    if (!signature || !env.payments.razorpayKeySecret) return false;
    const expected = crypto
      .createHmac('sha256', env.payments.razorpayKeySecret)
      .update(`${providerOrderId}|${paymentId}`)
      .digest('hex');
    return safeEqualHex(expected, signature);
  },
};

const providers = { mock: mockProvider, razorpay: razorpayProvider };

export function getPaymentProvider() {
  return providers[env.payments.provider] || mockProvider;
}

/** What the client needs to open the payment sheet. null for COD. */
export function buildPaymentInfo(order) {
  if (order.paymentMethod === 'cod' || !order.paymentProviderOrderId) return null;
  return {
    provider: env.payments.provider,
    keyId: env.payments.provider === 'razorpay' ? env.payments.razorpayKeyId : null,
    providerOrderId: order.paymentProviderOrderId,
    amount: order.pricing.total, // paise
    currency: 'INR',
  };
}

/**
 * Atomically marks an order paid. Safe to call from both /payments/verify and the webhook, in any
 * order, any number of times: only pending/failed, non-cancelled orders transition, and the
 * placed -> confirmed history entry is added at most once.
 * @returns {Promise<boolean>} true if this call performed the transition
 */
export async function markOrderPaid(orderId, paymentId, note) {
  const updated = await Order.findOneAndUpdate(
    { _id: orderId, paymentStatus: { $in: ['pending', 'failed'] }, status: { $ne: 'cancelled' } },
    { $set: { paymentStatus: 'paid', paymentId: paymentId || null } },
    { new: true }
  );
  if (!updated) return false;

  await Order.updateOne(
    { _id: orderId, status: 'placed' },
    { $set: { status: 'confirmed' }, $push: { statusHistory: { status: 'confirmed', at: new Date(), note } } }
  );
  return true;
}

/** Records a failed attempt — but never overwrites an order that has already been paid. */
export async function markPaymentFailed(orderId) {
  await Order.updateOne({ _id: orderId, paymentStatus: 'pending' }, { $set: { paymentStatus: 'failed' } });
}

/**
 * Customer-side confirmation after the Razorpay checkout sheet succeeds.
 * Verifies the signature against the provider order id WE stored (never one supplied by the client).
 */
export async function verifyOrderPayment(userId, { orderId, paymentId, signature, providerOrderId }) {
  const order = await Order.findOne({ _id: orderId, user: userId });
  if (!order) throw ApiError.notFound(ErrorCodes.ORDER_NOT_FOUND, 'Order not found');

  if (order.paymentMethod === 'cod' || !order.paymentProviderOrderId) {
    throw ApiError.badRequest(ErrorCodes.PAYMENT_NOT_REQUIRED, 'This order has no online payment to verify');
  }
  if (order.paymentStatus === 'paid') return order; // idempotent: already confirmed (e.g. by webhook)
  if (order.status === 'cancelled' || order.paymentStatus === 'refunded') {
    throw ApiError.badRequest(ErrorCodes.ORDER_NOT_PAYABLE, 'This order can no longer be paid');
  }

  const clientOrderIdMismatch = providerOrderId && providerOrderId !== order.paymentProviderOrderId;
  const valid =
    !clientOrderIdMismatch &&
    getPaymentProvider().verifyPaymentSignature({
      providerOrderId: order.paymentProviderOrderId,
      paymentId,
      signature,
    });
  if (!valid) {
    throw ApiError.badRequest(ErrorCodes.PAYMENT_SIGNATURE_INVALID, 'Payment signature verification failed');
  }

  await markOrderPaid(order._id, paymentId, 'Payment verified');
  return Order.findById(order._id);
}
