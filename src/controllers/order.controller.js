import { catchAsync } from '../utils/catchAsync.js';
import { sendSuccess } from '../utils/ApiResponse.js';
import { ApiError } from '../utils/ApiError.js';
import { ErrorCodes } from '../utils/errorCodes.js';
import * as orderService from '../services/order.service.js';
import { getPaymentProvider, buildPaymentInfo } from '../services/payment.service.js';

export const createOrder = catchAsync(async (req, res) => {
  const idempotencyKey = req.headers['idempotency-key'];
  if (!idempotencyKey) {
    throw ApiError.badRequest(ErrorCodes.IDEMPOTENCY_KEY_REQUIRED, 'Idempotency-Key header is required');
  }

  const order = await orderService.createOrder(req.user.id, { ...req.body, idempotencyKey });

  if (order.paymentMethod !== 'cod' && !order.paymentProviderOrderId) {
    const provider = getPaymentProvider();
    const providerOrder = await provider.createOrder({
      amountPaise: order.pricing.total,
      receipt: order.orderNumber,
    });
    order.paymentProviderOrderId = providerOrder.id;
    await order.save();
  }

  // `payment` carries what the client needs to open the Razorpay sheet (null for COD).
  sendSuccess(res, { statusCode: 201, data: { ...order.toJSON(), payment: buildPaymentInfo(order) } });
});

export const listOrders = catchAsync(async (req, res) => {
  const { page, limit } = req.query;
  const { docs, total, pages } = await orderService.listOrders(req.user.id, { page, limit });
  sendSuccess(res, { data: docs, meta: { total, page, limit, pages } });
});

export const getOrder = catchAsync(async (req, res) => {
  const order = await orderService.getOrderById(req.user.id, req.params.id);
  sendSuccess(res, { data: order });
});

export const cancelOrder = catchAsync(async (req, res) => {
  const order = await orderService.cancelOrder(req.user.id, req.params.id, req.body.reason);
  sendSuccess(res, { data: order });
});

export const adminListOrders = catchAsync(async (req, res) => {
  const { page, limit } = req.query;
  const { docs, total, pages } = await orderService.listAllOrders(req.query);
  sendSuccess(res, { data: docs, meta: { total, page, limit, pages } });
});

export const adminGetOrder = catchAsync(async (req, res) => {
  const order = await orderService.getOrderById(req.user.id, req.params.id, { isAdmin: true });
  sendSuccess(res, { data: order });
});

export const adminUpdateOrderStatus =catchAsync(async (req, res) => {
  const order = await orderService.updateOrderStatus(req.params.id, req.body.status, req.body.note);
  sendSuccess(res, { data: order });
});
