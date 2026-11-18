import { catchAsync } from '../utils/catchAsync.js';
import { sendSuccess } from '../utils/ApiResponse.js';
import * as pushService from '../services/push.service.js';

export const getVapidPublicKey = catchAsync(async (req, res) => {
  sendSuccess(res, { data: { publicKey: pushService.getVapidPublicKey() } });
});

export const subscribe = catchAsync(async (req, res) => {
  const sub = await pushService.subscribe(req.user.id, req.body, req.headers['user-agent']);
  sendSuccess(res, { statusCode: 201, data: { id: sub.id, endpoint: sub.endpoint, createdAt: sub.createdAt } });
});

export const unsubscribe = catchAsync(async (req, res) => {
  const removed = await pushService.unsubscribe(req.user.id, req.body.endpoint);
  sendSuccess(res, { data: { removed } });
});
