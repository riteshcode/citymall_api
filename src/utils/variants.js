import mongoose from 'mongoose';
import { Product } from '../models/Product.js';

/**
 * Helpers for products that sell through variants (Aata 1 kg / 5 kg / 10 kg).
 * A product with `variants.length > 0` is sold ONLY through its variants; a product without is sold as before.
 */

export const hasVariants = (product) => (product?.variants?.length ?? 0) > 0;

export const toObjectId = (id) => (id instanceof mongoose.Types.ObjectId ? id : new mongoose.Types.ObjectId(String(id)));

export function findVariant(product, variantId) {
  if (!variantId) return null;
  return product.variants.find((v) => v.id === String(variantId)) ?? null;
}

/**
 * What a cart / order line for (product, variantId) can actually be sold as RIGHT NOW. Never throws.
 *   available: false + reason when it cannot be bought:
 *     'inactive'          product (or variant) is switched off / gone
 *     'variant_required'  the product has variants but the line has none (e.g. a cart line from before variants existed)
 *     'variant_not_found' a variant was named on a product that has no such variant
 * `price / mrp / stock / unit / image` are the variant's when there is one, else the product's.
 */
export function resolveSellable(product, variantId = null) {
  const unavailable = (reason) => ({ available: false, reason, variant: null });
  if (!product || !product.isActive) return unavailable('inactive');

  if (hasVariants(product)) {
    if (!variantId) return { ...unavailable('variant_required'), ...productFields(product) };
    const variant = findVariant(product, variantId);
    if (!variant) return { ...unavailable('variant_not_found'), ...productFields(product) };
    if (!variant.isActive) return { ...unavailable('inactive'), variant, ...variantFields(product, variant) };
    return { available: true, reason: null, variant, ...variantFields(product, variant) };
  }

  if (variantId) return { ...unavailable('variant_not_found'), ...productFields(product) };
  return { available: true, reason: null, variant: null, ...productFields(product) };
}

const productFields = (p) => ({
  variantId: null,
  variantLabel: null,
  price: p.price,
  mrp: p.mrp,
  stock: p.stock,
  unit: p.unit,
  image: p.images?.[0] || '',
});

const variantFields = (p, v) => ({
  variantId: v.id,
  variantLabel: { en: v.label.en, hi: v.label.hi },
  price: v.price,
  mrp: v.mrp,
  stock: v.stock,
  unit: v.label.en,
  image: v.images?.[0] || p.images?.[0] || '',
});

/** Storefront JSON: the normal product JSON, but customers never see a variant the admin switched off. */
export function publicProductJSON(product) {
  const json = typeof product.toJSON === 'function' ? product.toJSON() : { ...product };
  if (Array.isArray(json.variants)) json.variants = json.variants.filter((v) => v.isActive);
  return json;
}

/** Mongo filter for "low stock" at `threshold`: plain products by their stock, variant products when ANY active variant is low. */
export function lowStockFilter(threshold) {
  return {
    $or: [
      { 'variants.0': { $exists: false }, stock: { $lte: threshold } },
      { variants: { $elemMatch: { isActive: true, stock: { $lte: threshold } } } },
    ],
  };
}

// ------------------------------------------------------------------ atomic stock changes

/** Aggregation-pipeline update: change one variant's stock by `delta` and recompute the product total in the same atomic write. */
const bumpVariantStock = (variantId, delta) => [
  {
    $set: {
      variants: {
        $map: {
          input: '$variants',
          as: 'v',
          in: {
            $cond: [
              { $eq: ['$$v._id', variantId] },
              { $mergeObjects: ['$$v', { stock: { $add: ['$$v.stock', delta] } }] },
              '$$v',
            ],
          },
        },
      },
    },
  },
  {
    $set: {
      stock: {
        $sum: {
          $map: { input: { $filter: { input: '$variants', as: 'v', cond: '$$v.isActive' } }, as: 'v', in: '$$v.stock' },
        },
      },
    },
  },
];

/**
 * Takes `qty` units out of stock if (and only if) there are enough — atomic, so concurrent orders can't oversell.
 * @returns {Promise<boolean>} false when the stock was not there any more
 */
export async function reserveStock(productId, variantId, qty, session) {
  if (variantId) {
    const vid = toObjectId(variantId);
    const res = await Product.updateOne(
      { _id: productId, variants: { $elemMatch: { _id: vid, isActive: true, stock: { $gte: qty } } } },
      bumpVariantStock(vid, -qty),
      { session }
    );
    return res.matchedCount === 1;
  }
  const res = await Product.updateOne(
    { _id: productId, 'variants.0': { $exists: false }, stock: { $gte: qty } },
    { $inc: { stock: -qty } },
    { session }
  );
  return res.matchedCount === 1;
}

/**
 * Puts `qty` units back (cancelled order) into the SAME variant they came from. If that variant has since been deleted,
 * or a plain product has since been given variants, there is nothing sensible to restore to and it is a no-op.
 */
export async function releaseStock(productId, variantId, qty, session) {
  if (variantId) {
    const vid = toObjectId(variantId);
    await Product.updateOne({ _id: productId, 'variants._id': vid }, bumpVariantStock(vid, qty), { session });
    return;
  }
  await Product.updateOne({ _id: productId, 'variants.0': { $exists: false } }, { $inc: { stock: qty } }, { session });
}
