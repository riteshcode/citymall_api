import { catchAsync } from '../utils/catchAsync.js';
import { sendSuccess } from '../utils/ApiResponse.js';
import * as riderService from '../services/rider.service.js';

// ---- admin
export const listRiders = catchAsync(async (req, res) => {
  const { page, limit } = req.query;
  const { docs, total, pages } = await riderService.listRiders(req.query);
  sendSuccess(res, { data: docs, meta: { total, page, limit, pages } });
});

export const createRider = catchAsync(async (req, res) => {
  sendSuccess(res, { statusCode: 201, data: await riderService.createRider(req.body) });
});

export const updateRider = catchAsync(async (req, res) => {
  sendSuccess(res, { data: await riderService.updateRider(req.params.id, req.body) });
});

// ---- rider app (req.user is the rider)
export const listMyOrders = catchAsync(async (req, res) => {
  const { page, limit } = req.query;
  const { docs, total, pages } = await riderService.listRiderOrders(req.user.id, req.query);
  sendSuccess(res, { data: docs, meta: { total, page, limit, pages } });
});

export const markOutForDelivery = catchAsync(async (req, res) => {
  sendSuccess(res, { data: await riderService.markOutForDelivery(req.user.id, req.params.id) });
});

export const deliverOrder = catchAsync(async (req, res) => {
  sendSuccess(res, { data: await riderService.deliverOrder(req.user.id, req.params.id, req.body) });
});
