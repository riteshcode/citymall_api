import mongoose from 'mongoose';
import { Review } from '../models/Review.js';
import { Order } from '../models/Order.js';
import { Product } from '../models/Product.js';
import { ApiError } from '../utils/ApiError.js';
import { ErrorCodes } from '../utils/errorCodes.js';
import { paginateQuery } from '../utils/mongoosePlugins.js';

async function recomputeProductRating(productId) {
  // Aggregation $match does NOT auto-cast like find()/updateOne() filters —
  // without this cast, a string productId never matches the stored ObjectId.
  const [agg] = await Review.aggregate([
    { $match: { product: new mongoose.Types.ObjectId(productId) } },
    { $group: { _id: '$product', avg: { $avg: '$rating' }, count: { $sum: 1 } } },
  ]);

  await Product.updateOne(
    { _id: productId },
    { ratingAvg: agg ? Math.round(agg.avg * 10) / 10 : 0, ratingCount: agg ? agg.count : 0 }
  );
}

export async function listProductReviews(productId, { page, limit }) {
  return paginateQuery(Review, { product: productId }, {
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

  const review = await Review.create({
    user: userId,
    product: productId,
    order: deliveredOrder._id,
    rating,
    comment,
  });

  await recomputeProductRating(productId);
  return review;
}
