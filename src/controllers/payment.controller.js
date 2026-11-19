import { catchAsync } from '../utils/catchAsync.js';
import { sendSuccess } from '../utils/ApiResponse.js';
import { ApiError } from '../utils/ApiError.js';
import { ErrorCodes } from '../utils/errorCodes.js';
import {
  getPaymentProvider,
  markOrderPaid,
  markPaymentFailed,
  verifyOrderPayment,
  buildPaymentInfo,
} from '../services/payment.service.js';
import { Order } from '../models/Order.js';
import { applyRefundEvent } from '../services/refund.service.js';
import { logger } from '../config/logger.js';

function extractPayment(payload) {
  return payload?.payload?.payment?.entity;
}

function extractProviderOrderId(payload) {
  return extractPayment(payload)?.order_id || payload?.orderId;
}

function extractStatus(payload) {
  const raw = extractPayment(payload)?.status || payload?.status;
  if (raw === 'captured' || raw === 'paid') return 'paid';
  if (raw === 'failed') return 'failed';
  return raw;
}

/**
 * Razorpay-shaped webhook. Mounted with express.raw() (see app.js) so the
 * exact bytes are available for HMAC signature verification before any
 * JSON parsing happens.
 */
export const handleWebhook = catchAsync(async (req, res) => {
  const signature = req.headers['x-razorpay-signature'] || req.headers['x-webhook-signature'];
  const provider = getPaymentProvider();

  const isValid = provider.verifySignature({ rawBody: req.body, signature });
  if (!isValid) {
    throw ApiError.badRequest(ErrorCodes.PAYMENT_SIGNATURE_INVALID, 'Webhook signature verification failed');
  }

  const payload = JSON.parse(req.body.toString('utf8'));

  // Refund results: refund.processed / refund.failed (refund.created and the rest are just acknowledged).
  if (typeof payload.event === 'string' && payload.event.startsWith('refund.')) {
    const entity = payload?.payload?.refund?.entity;
    const outcome = payload.event === 'refund.processed' ? 'processed' : payload.event === 'refund.failed' ? 'failed' : null;
    if (!outcome || !entity?.id) return sendSuccess(res, { data: { received: true, matched: false } });
    const matched = await applyRefundEvent(outcome, entity);
    return sendSuccess(res, { data: { received: true, matched } });
  }

  const providerOrderId = extractProviderOrderId(payload);
  const status = extractStatus(payload);

  if (!providerOrderId) return sendSuccess(res, { data: { received: true, matched: false } });

  // Current gateway order, or one abandoned by a payment retry / switch to COD (the customer may still have paid it).
  const order = await Order.findOne({
    $or: [{ paymentProviderOrderId: providerOrderId }, { previousProviderOrderIds: providerOrderId }],
  });
  if (!order) {
    // Ack with 200 regardless so the provider doesn't retry forever on an order we can't map.
    return sendSuccess(res, { data: { received: true, matched: false } });
  }

  if (status === 'paid') {
    if (order.status === 'cancelled') {
      logger.warn(`[Payments] order ${order.orderNumber} was paid online AFTER it was cancelled - refund it with POST /admin/orders/:id/refund`);
    }
    if (order.paymentMethod === 'cod') {
      logger.warn(`[Payments] order ${order.orderNumber} was paid online after being switched to COD - reconcile manually`);
    }
    await markOrderPaid(order._id, extractPayment(payload)?.id, 'Payment confirmed via webhook');
  } else if (status === 'failed') {
    await markPaymentFailed(order._id);
  }

  sendSuccess(res, { data: { received: true, matched: true } });
});

/** Customer confirms a completed checkout: POST /payments/verify */
export const verifyPayment = catchAsync(async (req, res) => {
  const { orderId, razorpay_payment_id, razorpay_signature, razorpay_order_id } = req.body;
  const order = await verifyOrderPayment(req.user.id, {
    orderId,
    paymentId: razorpay_payment_id,
    signature: razorpay_signature,
    providerOrderId: razorpay_order_id,
  });
  sendSuccess(res, { data: { ...order.toJSON(), payment: buildPaymentInfo(order) } });
});
