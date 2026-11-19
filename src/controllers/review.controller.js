import { catchAsync } from '../utils/catchAsync.js';
import { sendSuccess } from '../utils/ApiResponse.js';
import * as reviewService from '../services/review.service.js';

export const listReviews = catchAsync(async (req, res) => {
  const { page, limit } = req.query;
  const { docs, total, pages } = await reviewService.listProductReviews(req.params.id, { page, limit });
  sendSuccess(res, { data: docs.map(reviewService.publicReviewJSON), meta: { total, page, limit, pages } });
});

// The customer sees their own review's status, never the admin's internal moderation note.
export const createReview = catchAsync(async (req, res) => {
  const review = await reviewService.createReview(req.user.id, req.params.id, req.body);
  sendSuccess(res, { statusCode: 201, data: reviewService.publicReviewJSON(review) });
});

/** GET /products/:id/reviews/mine - the caller's own review in any status, or null. */
export const getMyReview = catchAsync(async (req, res) => {
  const review = await reviewService.getMyReview(req.user.id, req.params.id);
  sendSuccess(res, { data: review ? reviewService.publicReviewJSON(review) : null });
});
