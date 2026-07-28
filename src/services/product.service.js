import mongoose from 'mongoose';
import { Product } from '../models/Product.js';
import { ApiError } from '../utils/ApiError.js';
import { ErrorCodes } from '../utils/errorCodes.js';

const SORT_STAGES = {
  popular: { ratingCount: -1, ratingAvg: -1 },
  price_asc: { price: 1 },
  price_desc: { price: -1 },
  newest: { createdAt: -1 },
  discount: { _discountPercent: -1 },
};

/**
 * Lists products with the storefront filter/sort/search/pagination set.
 * Runs as a single aggregation so "sort by discount" (a virtual, not a
 * stored field) and full-text search score can both drive the $sort stage.
 */
export async function listProducts(filters) {
  const { category, minPrice, maxPrice, brand, rating, inStock, sort = 'newest', q, page = 1, limit = 20 } = filters;

  const match = { isActive: true };
  if (category) match.category = new mongoose.Types.ObjectId(category);
  if (brand) match.brand = new RegExp(`^${brand}$`, 'i');
  if (rating) match.ratingAvg = { $gte: Number(rating) };
  if (inStock) match.stock = { $gt: 0 };
  if (minPrice != null || maxPrice != null) {
    match.price = {};
    if (minPrice != null) match.price.$gte = minPrice;
    if (maxPrice != null) match.price.$lte = maxPrice;
  }
  if (q) match.$text = { $search: q };

  const safePage = Math.max(1, page);
  const safeLimit = Math.min(100, Math.max(1, limit));

  const pipeline = [
    { $match: match },
    {
      $addFields: {
        _discountPercent: {
          $cond: [
            { $and: [{ $gt: ['$mrp', 0] }, { $lt: ['$price', '$mrp'] }] },
            { $round: [{ $multiply: [{ $divide: [{ $subtract: ['$mrp', '$price'] }, '$mrp'] }, 100] }] },
            0,
          ],
        },
        ...(q ? { _score: { $meta: 'textScore' } } : {}),
      },
    },
    { $sort: q && sort === 'popular' ? { _score: -1 } : SORT_STAGES[sort] || SORT_STAGES.newest },
    {
      $facet: {
        docs: [{ $skip: (safePage - 1) * safeLimit }, { $limit: safeLimit }],
        totalCount: [{ $count: 'count' }],
      },
    },
  ];

  const [{ docs, totalCount }] = await Product.aggregate(pipeline);
  const total = totalCount[0]?.count || 0;

  return {
    docs: docs.map((d) => Product.hydrate(d).toJSON()),
    total,
    page: safePage,
    limit: safeLimit,
    pages: Math.max(1, Math.ceil(total / safeLimit)),
  };
}

export async function getProductBySlug(slug) {
  const product = await Product.findOne({ slug, isActive: true }).populate('category', 'name slug');
  if (!product) {
    throw ApiError.notFound(ErrorCodes.PRODUCT_NOT_FOUND, 'Product not found');
  }
  return product;
}

export async function getRelatedProducts(productId, limit = 10) {
  const product = await Product.findById(productId);
  if (!product) {
    throw ApiError.notFound(ErrorCodes.PRODUCT_NOT_FOUND, 'Product not found');
  }

  return Product.find({
    _id: { $ne: product._id },
    category: product.category,
    isActive: true,
  })
    .sort({ ratingAvg: -1 })
    .limit(limit);
}
