import mongoose from 'mongoose';
import { Order } from '../models/Order.js';
import { logger } from '../config/logger.js';
import { ApiError } from '../utils/ApiError.js';
import { ErrorCodes } from '../utils/errorCodes.js';
import { getPaymentProvider } from './payment.service.js';

/**
 * Refunds of online payments.
 *
 * Every refund is one entry of Order.refunds ({ refundId, amount, status, reason, source, ... }); the order-level
 * refundStatus / refundId / refundedAmount / refundedAt are a SUMMARY recomputed from that list in a single atomic
 * update (syncRefundSummary), so webhooks and API calls can arrive in any order, any number of times.
 *   paymentStatus becomes "refunded" only when processed refunds cover the whole paid amount - never earlier.
 */

const ONLINE_METHODS = ['upi', 'card', 'netbanking'];

/** $expr: total of the refunds that still count (pending + processed; failed ones free the amount again). */
const COUNTED_REFUND_TOTAL = {
  $sum: {
    $map: { input: { $filter: { input: { $ifNull: ['$refunds', []] }, cond: { $ne: ['$$this.status', 'failed'] } } }, in: '$$this.amount' },
  },
};

/** Paise that can still be refunded: paid amount minus refunds that are pending or processed. */
export function refundableRemaining(order) {
  const counted = (order.refunds ?? []).filter((r) => r.status !== 'failed').reduce((sum, r) => sum + r.amount, 0);
  return Math.max(0, order.pricing.total - counted);
}

/** Recomputes the order-level refund summary from Order.refunds, atomically. */
export async function syncRefundSummary(orderId) {
  return Order.findOneAndUpdate(
    { _id: orderId },
    [
      {
        $set: {
          refundedAmount: {
            $sum: {
              $map: { input: { $filter: { input: { $ifNull: ['$refunds', []] }, cond: { $eq: ['$$this.status', 'processed'] } } }, in: '$$this.amount' },
            },
          },
          refundStatus: { $ifNull: [{ $arrayElemAt: [{ $ifNull: ['$refunds.status', []] }, -1] }, null] },
          refundId: { $ifNull: [{ $arrayElemAt: [{ $ifNull: ['$refunds.refundId', []] }, -1] }, null] },
          refundedAt: { $ifNull: [{ $max: { $ifNull: ['$refunds.processedAt', []] } }, null] },
        },
      },
      {
        $set: {
          paymentStatus: {
            $cond: [{ $and: [{ $eq: ['$paymentStatus', 'paid'] }, { $gt: ['$refundedAmount', 0] }, { $gte: ['$refundedAmount', '$pricing.total'] }] }, 'refunded', '$paymentStatus'],
          },
        },
      },
    ],
    { new: true }
  );
}

/**
 * Starts a refund of `amount` paise (default: everything still refundable) for a paid online order.
 *
 * The amount is RESERVED first with one conditional update (so two simultaneous requests can never refund more than was
 * paid), then the gateway is called. A gateway failure marks that refund "failed" (the amount becomes refundable again,
 * an admin can retry) and throws REFUND_PROVIDER_ERROR. The mock provider reports "processed" immediately; Razorpay
 * answers "pending" and finishes through the refund.processed / refund.failed webhook.
 *
 * @param {string} orderId
 * @param {{ amount?: number, reason: string, source: 'cancel'|'admin' }} options
 * @returns {Promise<{ order: import('mongoose').Document, refund: object }>}
 */
export async function startRefund(orderId, { amount, reason, source }) {
  const order = await Order.findById(orderId);
  if (!order) throw ApiError.notFound(ErrorCodes.ORDER_NOT_FOUND, 'Order not found');

  if (!ONLINE_METHODS.includes(order.paymentMethod)) {
    throw ApiError.badRequest(ErrorCodes.REFUND_NOT_ALLOWED, 'Only online payments can be refunded through the gateway');
  }
  if (order.paymentStatus !== 'paid' || !order.paymentId) {
    throw ApiError.badRequest(ErrorCodes.REFUND_NOT_ALLOWED, 'This order has no captured online payment to refund');
  }

  const remaining = refundableRemaining(order);
  if (remaining <= 0) throw ApiError.badRequest(ErrorCodes.REFUND_NOT_ALLOWED, 'This order is already fully refunded');
  const refundAmount = amount ?? remaining;
  const exceeded = () =>
    ApiError.badRequest(ErrorCodes.REFUND_AMOUNT_EXCEEDED, `Cannot refund more than the paid amount: at most ${remaining} paise can still be refunded`, {
      maxRefundable: remaining,
      paid: order.pricing.total,
    });
  if (refundAmount > remaining) throw exceeded();

  // Reserve the amount (guards the total against concurrent refunds).
  const entryId = new mongoose.Types.ObjectId();
  const reserved = await Order.findOneAndUpdate(
    {
      _id: orderId,
      paymentStatus: 'paid',
      $expr: { $lte: [{ $add: [COUNTED_REFUND_TOTAL, refundAmount] }, '$pricing.total'] },
    },
    { $push: { refunds: { _id: entryId, amount: refundAmount, status: 'pending', reason, source, createdAt: new Date() } } },
    { new: true }
  );
  if (!reserved) throw exceeded(); // lost a race with another refund
  await syncRefundSummary(orderId);

  let gateway;
  try {
    gateway = await getPaymentProvider().refund({
      paymentId: order.paymentId,
      amountPaise: refundAmount,
      receipt: `${order.orderNumber}-${entryId.toString().slice(-6)}`,
      notes: { orderNumber: order.orderNumber, reason: String(reason).slice(0, 200) },
    });
  } catch (err) {
    await Order.updateOne(
      { _id: orderId },
      { $set: { 'refunds.$[r].status': 'failed', 'refunds.$[r].failureReason': String(err.message).slice(0, 300) } },
      { arrayFilters: [{ 'r._id': entryId, 'r.status': 'pending' }] }
    );
    await syncRefundSummary(orderId);
    logger.error(`[Refund] order ${order.orderNumber}: gateway refused a refund of ${refundAmount} paise: ${err.message}`);
    throw err instanceof ApiError ? err : new ApiError(502, ErrorCodes.REFUND_PROVIDER_ERROR, 'The payment provider could not start the refund');
  }

  // 1) remember the gateway's id (a webhook may already have processed it), 2) move on from "pending" if it already finished.
  await Order.updateOne({ _id: orderId }, { $set: { 'refunds.$[r].refundId': gateway.id } }, { arrayFilters: [{ 'r._id': entryId }] });
  if (gateway.status === 'processed' || gateway.status === 'failed') {
    await Order.updateOne(
      { _id: orderId },
      { $set: { 'refunds.$[r].status': gateway.status, ...(gateway.status === 'processed' ? { 'refunds.$[r].processedAt': new Date() } : {}) } },
      { arrayFilters: [{ 'r._id': entryId, 'r.status': 'pending' }] }
    );
  }
  const updated = await syncRefundSummary(orderId);
  return { order: updated, refund: updated.refunds.find((r) => r.id === entryId.toString()) };
}

/** Cancellation of a paid online order: refund everything still refundable. Never throws (the cancel must stand). */
export async function refundOnCancel(order, reason) {
  if (!ONLINE_METHODS.includes(order.paymentMethod) || order.paymentStatus !== 'paid' || !order.paymentId) return null;
  try {
    return await startRefund(order._id, { reason, source: 'cancel' });
  } catch (err) {
    logger.error(`[Refund] order ${order.orderNumber} was cancelled but its refund could not be started (${err.code ?? err.message}); retry with POST /admin/orders/:id/refund`);
    return null;
  }
}

// ================================================================== webhook: refund.processed / refund.failed

/**
 * Applies a gateway refund event. Idempotent: only a "pending" refund moves, once; repeats change nothing.
 * @param {'processed'|'failed'} status
 * @param {{ id: string, payment_id: string, amount: number }} entity Razorpay refund entity
 * @returns {Promise<boolean>} whether an order was found
 */
export async function applyRefundEvent(status, entity) {
  const order = await Order.findOne({ $or: [{ 'refunds.refundId': entity.id }, { paymentId: entity.payment_id }] });
  if (!order) return false;

  const set = (prefix) => ({ [`${prefix}.status`]: status, ...(status === 'processed' ? { [`${prefix}.processedAt`]: new Date() } : {}) });

  // 1) a refund we already know by its gateway id
  const known = await Order.updateOne(
    { _id: order._id },
    { $set: { 'refunds.$[r].status': status, ...(status === 'processed' ? { 'refunds.$[r].processedAt': new Date() } : {}) } },
    // timestamps:false so modifiedCount really means "a pending refund moved" (an updatedAt bump would always count)
    { arrayFilters: [{ 'r.refundId': entity.id, 'r.status': 'pending' }], timestamps: false }
  );

  if (known.modifiedCount === 0 && !(await Order.exists({ _id: order._id, 'refunds.refundId': entity.id }))) {
    // 2) the webhook beat startRefund's bookkeeping: adopt our pending entry that has no gateway id yet
    const adopted = await Order.updateOne(
      { _id: order._id, refunds: { $elemMatch: { refundId: null, status: 'pending', amount: entity.amount } } },
      { $set: { 'refunds.$.refundId': entity.id, ...set('refunds.$') } }
    );
    // 3) a refund made outside this API (e.g. from the Razorpay dashboard): record it so the totals stay true
    if (adopted.modifiedCount === 0) {
      await Order.updateOne(
        { _id: order._id, 'refunds.refundId': { $ne: entity.id } },
        {
          $push: {
            refunds: {
              refundId: entity.id,
              amount: entity.amount,
              status,
              reason: 'Refunded outside the API',
              source: 'gateway',
              createdAt: new Date(),
              processedAt: status === 'processed' ? new Date() : null,
            },
          },
        }
      );
    }
  }

  await syncRefundSummary(order._id);
  return true;
}

// ================================================================== admin: POST /admin/orders/:id/refund

/** Partial or full refund of a paid online order (e.g. one item was missing). Returns the order as the admin sees it. */
export async function adminRefundOrder(orderId, { amount, reason }) {
  await startRefund(orderId, { amount, reason, source: 'admin' });
  return Order.findById(orderId)
    .populate({ path: 'user', select: 'name mobile email isVerified createdAt' })
    .populate({ path: 'rider', select: 'name mobile' });
}
