import mongoose from 'mongoose';
import { Review } from '../models/Review.js';
import { Order } from '../models/Order.js';
import { Product } from '../models/Product.js';
import { ApiError } from '../utils/ApiError.js';
import { ErrorCodes } from '../utils/errorCodes.js';
import { paginateQuery } from '../utils/mongoosePlugins.js';

/** ratingAvg / ratingCount come from APPROVED reviews only. Recomputed from scratch on every moderation change. */
async function recomputeProductRating(productId) {
  // Aggregation $match does NOT auto-cast like find()/updateOne() filters —
  // without this cast, a string productId never matches the stored ObjectId.
  const [agg] = await Review.aggregate([
    { $match: { product: new mongoose.Types.ObjectId(productId), status: 'approved' } },
    { $group: { _id: '$product', avg: { $avg: '$rating' }, count: { $sum: 1 } } },
  ]);

  const rating = { ratingAvg: agg ? Math.round(agg.avg * 10) / 10 : 0, ratingCount: agg ? agg.count : 0 };
  await Product.updateOne({ _id: productId }, rating);
  return rating;
}

/** Storefront / owner shape of a review: no moderation internals (note, timestamp). */
export function publicReviewJSON(review) {
  const { moderationNote, moderatedAt, ...rest } = review.toJSON();
  return rest;
}

/** Admin: all reviews (every status unless `status` is given), newest first, with who wrote them and what they're about. */
export async function listAllReviews({ page, limit, productId, rating, status }) {
  const filter = {};
  if (productId) filter.product = productId;
  if (rating) filter.rating = rating;
  if (status) filter.status = status;
  return paginateQuery(Review, filter, {
    page,
    limit,
    sort: { createdAt: -1 },
    populate: [
      { path: 'user', select: 'name mobile' },
      { path: 'product', select: 'title slug' },
    ],
  });
}

/** Admin: removes a review and recalculates the product's ratingAvg / ratingCount (the author may review again). */
export async function deleteReview(reviewId) {
  const review = await Review.findByIdAndDelete(reviewId);
  if (!review) throw ApiError.notFound(ErrorCodes.REVIEW_NOT_FOUND, 'Review not found');
  const rating = await recomputeProductRating(review.product.toString());
  return { id: review.id, product: { id: review.product.toString(), ...rating } };
}

/**
 * Admin: approve or reject a review (either can be changed later). Returns the review plus the product's recalculated
 * { id, ratingAvg, ratingCount }.
 */
export async function moderateReview(reviewId, { status, note }) {
  const review = await Review.findByIdAndUpdate(
    reviewId,
    { $set: { status, moderatedAt: new Date(), moderationNote: note ?? null } },
    { new: true, runValidators: true }
  ).populate([
    { path: 'user', select: 'name mobile' },
    { path: 'product', select: 'title slug' },
  ]);
  if (!review) throw ApiError.notFound(ErrorCodes.REVIEW_NOT_FOUND, 'Review not found');

  const productId = review.product._id.toString();
  const rating = await recomputeProductRating(productId);
  return { review, product: { id: productId, ...rating } };
}

/** Public: approved reviews of a product only. */
export async function listProductReviews(productId, { page, limit }) {
  return paginateQuery(Review, { product: productId, status: 'approved' }, {
    page,
    limit,
    sort: { createdAt: -1 },
    populate: { path: 'user', select: 'name' },
  });
}

export async function createReview(userId, productId, { rating, comment }) {
  const deliveredOrder = await Order.findOne({
    user: userId,
    status: 'delivered',
    'items.product': productId,
  });

  if (!deliveredOrder) {
    throw ApiError.badRequest(
      ErrorCodes.REVIEW_REQUIRES_DELIVERED_ORDER,
      'You can only review products from a delivered order'
    );
  }

  const alreadyReviewed = await Review.findOne({ user: userId, product: productId });
  if (alreadyReviewed) {
    throw ApiError.conflict(ErrorCodes.REVIEW_ALREADY_EXISTS, 'You have already reviewed this product');
  }

  // Starts as "pending": it does not touch the product's rating until an admin approves it.
  return Review.create({
    user: userId,
    product: productId,
    order: deliveredOrder._id,
    rating,
    comment,
    status: 'pending',
  });
}

/** The caller's own review of a product in ANY status (null when they have none) - for "sent for approval" notices. */
export async function getMyReview(userId, productId) {
  return Review.findOne({ user: userId, product: productId });
}
