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
  const providerOrderId = extractProviderOrderId(payload);
  const status = extractStatus(payload);

  const order = await Order.findOne({ paymentProviderOrderId: providerOrderId });
  if (!order) {
    // Ack with 200 regardless so the provider doesn't retry forever on an order we can't map.
    return sendSuccess(res, { data: { received: true, matched: false } });
  }

  if (status === 'paid') {
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
