import { catchAsync } from '../utils/catchAsync.js';
import { sendSuccess } from '../utils/ApiResponse.js';
import * as reviewService from '../services/review.service.js';

export const listReviews = catchAsync(async (req, res) => {
  const { page, limit } = req.query;
  const { docs, total, pages } = await reviewService.listProductReviews(req.params.id, { page, limit });
  sendSuccess(res, { data: docs, meta: { total, page, limit, pages } });
});

export const createReview = catchAsync(async (req, res) => {
  const review = await reviewService.createReview(req.user.id, req.params.id, req.body);
  sendSuccess(res, { statusCode: 201, data: review });
});
