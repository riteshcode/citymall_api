import crypto from 'crypto';
import { env } from '../config/env.js';
import { logger } from '../config/logger.js';
import { Order } from '../models/Order.js';
import { ApiError } from '../utils/ApiError.js';
import { ErrorCodes } from '../utils/errorCodes.js';
import { notifyOrderStatusChange } from './push.service.js';

/**
 * PaymentProvider interface every provider implements:
 *   createOrder({ amountPaise, currency, receipt }): Promise<{ id, amount, currency, status }>
 *   verifySignature({ rawBody, signature }): boolean              // webhook (HMAC over raw body, webhook secret)
 *   verifyPaymentSignature({ providerOrderId, paymentId, signature }): boolean   // checkout callback
 *   refund({ paymentId, amountPaise, receipt, notes }): Promise<{ id, amount, status: 'pending'|'processed'|'failed' }>
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

  /** The mock gateway finishes every refund at once. */
  async refund({ paymentId, amountPaise }) {
    const id = `rfnd_mock_${crypto.randomBytes(8).toString('hex')}`;
    logger.info(`[Payments:mock] refunded ${amountPaise} paise of ${paymentId} as ${id}`);
    return { id, amount: amountPaise, status: 'processed' };
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

  /**
   * Real Razorpay refund (https://razorpay.com/docs/api/refunds/create-instant/ - "normal" speed). Usually answers
   * "pending"; the final state arrives through the refund.processed / refund.failed webhook.
   */
  async refund({ paymentId, amountPaise, receipt, notes }) {
    const { razorpayKeyId, razorpayKeySecret } = env.payments;
    if (!razorpayKeyId || !razorpayKeySecret) {
      throw new ApiError(503, ErrorCodes.REFUND_PROVIDER_ERROR, 'Online payments are not configured');
    }

    let res;
    try {
      res = await fetch(`https://api.razorpay.com/v1/payments/${encodeURIComponent(paymentId)}/refund`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Basic ${Buffer.from(`${razorpayKeyId}:${razorpayKeySecret}`).toString('base64')}`,
        },
        body: JSON.stringify({ amount: amountPaise, speed: 'normal', receipt, notes }),
        signal: AbortSignal.timeout(10_000),
      });
    } catch (err) {
      logger.error(`[Payments:razorpay] refund request failed: ${err.message}`);
      throw new ApiError(502, ErrorCodes.REFUND_PROVIDER_ERROR, 'Could not reach the payment provider, please retry');
    }

    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      const why = body?.error?.description || `HTTP ${res.status}`;
      logger.error(`[Payments:razorpay] refund failed ${res.status}: ${why}`);
      throw new ApiError(502, ErrorCodes.REFUND_PROVIDER_ERROR, `The payment provider refused the refund: ${why}`);
    }
    return { id: body.id, amount: body.amount, status: body.status === 'processed' ? 'processed' : body.status === 'failed' ? 'failed' : 'pending' };
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

  const confirmed = await Order.updateOne(
    { _id: orderId, status: 'placed' },
    { $set: { status: 'confirmed' }, $push: { statusHistory: { status: 'confirmed', at: new Date(), note } } }
  );
  if (confirmed.modifiedCount === 1) notifyOrderStatusChange(await Order.findById(orderId));
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

// ---------------------------------------------------------------- retry / switch to COD

const ONLINE_METHODS = ['upi', 'card', 'netbanking'];

// The one definition of "this order's online payment can still be (re)attempted".
const payableFilter = (orderId, userId) => ({
  _id: orderId,
  user: userId,
  paymentMethod: { $in: ONLINE_METHODS },
  paymentStatus: { $in: ['pending', 'failed'] },
  status: { $ne: 'cancelled' },
});

/** Gateway orders replaced by a retry are remembered so a late webhook for the abandoned attempt still matches. */
const archiveCurrentProviderOrder = (order) =>
  order.paymentProviderOrderId ? { $push: { previousProviderOrderIds: order.paymentProviderOrderId } } : {};

/**
 * "Pay again" after a failed / abandoned online payment: creates a fresh gateway order for the same amount.
 * @returns {Promise<object>} the `payment` block (same shape as POST /orders returns)
 */
export async function retryOrderPayment(userId, orderId) {
  const order = await Order.findOne(payableFilter(orderId, userId));
  if (!order) {
    // Distinguish "not yours / doesn't exist" (404) from "exists but not retryable" (400).
    if (!(await Order.exists({ _id: orderId, user: userId }))) throw ApiError.notFound(ErrorCodes.ORDER_NOT_FOUND, 'Order not found');
    throw ApiError.badRequest(
      ErrorCodes.PAYMENT_NOT_RETRYABLE,
      'Only an unpaid online-payment order that is not cancelled can be paid again'
    );
  }

  const providerOrder = await getPaymentProvider().createOrder({ amountPaise: order.pricing.total, receipt: order.orderNumber });

  // Swap atomically, and only if the order is STILL retryable (a webhook may have marked it paid meanwhile).
  const updated = await Order.findOneAndUpdate(
    payableFilter(orderId, userId),
    { $set: { paymentProviderOrderId: providerOrder.id, paymentStatus: 'pending' }, ...archiveCurrentProviderOrder(order) },
    { new: true }
  );
  if (!updated) {
    throw ApiError.badRequest(ErrorCodes.PAYMENT_NOT_RETRYABLE, 'This order\'s payment status just changed');
  }
  return buildPaymentInfo(updated);
}

/** Online payment keeps failing -> the customer pays cash on delivery instead. Only while unpaid and not cancelled. */
export async function switchOrderToCod(userId, orderId) {
  const order = await Order.findOne(payableFilter(orderId, userId));
  if (!order) {
    if (!(await Order.exists({ _id: orderId, user: userId }))) throw ApiError.notFound(ErrorCodes.ORDER_NOT_FOUND, 'Order not found');
    throw ApiError.badRequest(
      ErrorCodes.PAYMENT_METHOD_NOT_CHANGEABLE,
      'Payment method can only be changed on an unpaid online-payment order that is not cancelled'
    );
  }

  const updated = await Order.findOneAndUpdate(
    payableFilter(orderId, userId),
    { $set: { paymentMethod: 'cod', paymentStatus: 'pending', paymentProviderOrderId: null }, ...archiveCurrentProviderOrder(order) },
    { new: true }
  );
  if (!updated) {
    throw ApiError.badRequest(ErrorCodes.PAYMENT_METHOD_NOT_CHANGEABLE, 'This order\'s payment status just changed');
  }
  return updated;
}
