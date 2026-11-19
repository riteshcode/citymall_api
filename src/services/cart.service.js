import { Cart } from '../models/Cart.js';
import { Product } from '../models/Product.js';
import { ApiError } from '../utils/ApiError.js';
import { ErrorCodes } from '../utils/errorCodes.js';
import { buildPricing, computeSubtotal } from './pricing.service.js';
import { getEligibleCoupon } from './coupon.service.js';
import { getSettings } from './settings.service.js';
import { resolveDelivery } from './serviceability.service.js';
import { resolveSellable } from '../utils/variants.js';

async function getOrCreateCart(userId) {
  let cart = await Cart.findOne({ user: userId });
  if (!cart) cart = await Cart.create({ user: userId, items: [] });
  return cart;
}

/**
 * Resolves a cart's items against LIVE product data and returns the full
 * shape the client renders directly (no local math needed). Server prices
 * are always re-read here — priceAtAdd on the cart item is never trusted.
 *
 * @param {{ pincode?: string }} [options] when given and serviceable, that pincode's delivery-fee
 *   override is previewed so the cart total matches what checkout will charge.
 */
async function buildCartView(cart, { pincode } = {}) {
  const productIds = cart.items.map((i) => i.product);
  const products = await Product.find({ _id: { $in: productIds } });
  const productMap = new Map(products.map((p) => [p.id, p]));

  const lineItems = [];
  const responseItems = [];

  for (const item of cart.items) {
    const product = productMap.get(item.product.toString());
    const sellable = resolveSellable(product, item.variantId);
    const isAvailable = sellable.available;

    if (isAvailable) {
      lineItems.push({ price: sellable.price, qty: item.qty });
    }

    // price / mrp / stock / unit / image are the VARIANT's when the line has one, else the product's.
    responseItems.push({
      productId: item.product.toString(),
      variantId: item.variantId ? item.variantId.toString() : null,
      variantLabel: sellable.variantLabel ?? null,
      title: product ? product.title : null,
      slug: product ? product.slug : null,
      image: sellable.image ?? '',
      unit: product ? sellable.unit : null,
      price: sellable.price ?? item.priceAtAdd,
      mrp: sellable.mrp ?? null,
      qty: item.qty,
      stock: sellable.stock ?? 0,
      isAvailable,
      inStock: isAvailable && sellable.stock >= item.qty,
      lineTotal: isAvailable ? sellable.price * item.qty : 0,
    });
  }

  const subtotal = computeSubtotal(lineItems);
  let coupon = null;
  let couponError = null;

  if (cart.couponCode) {
    try {
      coupon = await getEligibleCoupon(cart.couponCode, { subtotal, userId: cart.user });
    } catch (err) {
      couponError = { code: err.code, message: err.message };
    }
  }

  const settings = await getSettings();
  const delivery = pincode ? await resolveDelivery(pincode) : null;
  const pricing = buildPricing({
    lineItems,
    coupon,
    settings,
    deliveryFeeOverride: delivery?.serviceable ? delivery.deliveryFeeOverride : null,
  });

  return {
    items: responseItems,
    pricing,
    couponCode: coupon ? coupon.code : null,
    couponError,
  };
}

export async function getCart(userId, options) {
  const cart = await getOrCreateCart(userId);
  return buildCartView(cart, options);
}

/** A cart line is identified by (product, variant): two variants of one product are two lines. */
const sameLine = (item, productId, variantId) =>
  item.product.toString() === String(productId) && (item.variantId ? item.variantId.toString() : null) === (variantId ? String(variantId) : null);

export async function addItem(userId, productId, variantId, qty) {
  const product = await Product.findById(productId);
  const sellable = resolveSellable(product, variantId);

  if (!sellable.available) {
    if (sellable.reason === 'variant_required') {
      throw ApiError.badRequest(ErrorCodes.VARIANT_REQUIRED, 'Choose an option (variantId) for this product', {
        options: product.variants.filter((v) => v.isActive).map((v) => ({ id: v.id, label: v.label })),
      });
    }
    if (sellable.reason === 'inactive' && !sellable.variant) {
      throw ApiError.notFound(ErrorCodes.PRODUCT_NOT_FOUND, 'Product not found');
    }
    throw ApiError.notFound(ErrorCodes.VARIANT_NOT_FOUND, 'This option is not available for the product');
  }

  const cart = await getOrCreateCart(userId);
  const existing = cart.items.find((i) => sameLine(i, productId, variantId));

  if (existing) {
    existing.qty += qty;
    existing.priceAtAdd = sellable.price;
  } else {
    cart.items.push({ product: product._id, variantId: variantId ?? null, qty, priceAtAdd: sellable.price });
  }

  await cart.save();
  return buildCartView(cart);
}

export async function updateItemQty(userId, productId, variantId, qty) {
  const cart = await getOrCreateCart(userId);
  const idx = cart.items.findIndex((i) => sameLine(i, productId, variantId));

  if (idx === -1) {
    if (qty === 0) return buildCartView(cart);
    throw ApiError.notFound(ErrorCodes.PRODUCT_NOT_FOUND, 'Item not found in cart');
  }

  if (qty <= 0) {
    cart.items.splice(idx, 1);
  } else {
    cart.items[idx].qty = qty;
  }

  await cart.save();
  return buildCartView(cart);
}

export async function removeItem(userId, productId, variantId) {
  return updateItemQty(userId, productId, variantId, 0);
}

export async function clearCart(userId) {
  const cart = await getOrCreateCart(userId);
  cart.items = [];
  cart.couponCode = null;
  await cart.save();
  return buildCartView(cart);
}

export async function applyCoupon(userId, code) {
  const cart = await getOrCreateCart(userId);
  if (cart.items.length === 0) {
    throw ApiError.badRequest(ErrorCodes.CART_EMPTY, 'Add items to your cart before applying a coupon');
  }

  const productIds = cart.items.map((i) => i.product);
  const products = await Product.find({ _id: { $in: productIds } });
  const productMap = new Map(products.map((p) => [p.id, p]));
  const lineItems = cart.items
    .map((i) => ({ sellable: resolveSellable(productMap.get(i.product.toString()), i.variantId), qty: i.qty }))
    .filter((l) => l.sellable.available)
    .map((l) => ({ price: l.sellable.price, qty: l.qty }));

  const subtotal = computeSubtotal(lineItems);

  // Validate eagerly so the client gets an immediate, specific error code.
  await getEligibleCoupon(code, { subtotal, userId });

  cart.couponCode = code.toUpperCase();
  await cart.save();
  return buildCartView(cart);
}

export async function removeCoupon(userId) {
  const cart = await getOrCreateCart(userId);
  if (!cart.couponCode) {
    throw ApiError.badRequest(ErrorCodes.NO_COUPON_APPLIED, 'No coupon is currently applied');
  }
  cart.couponCode = null;
  await cart.save();
  return buildCartView(cart);
}

/**
 * "Buy again": adds the items of a past order to the user's cart at TODAY's prices (the cart view always
 * re-reads live prices) and never beyond today's stock. Anything that couldn't be added in full is reported:
 *   inactive      - the product no longer exists / was switched off
 *   out_of_stock  - no stock left (or the cart already holds all of it)
 *   qty_reduced   - some stock, but less than the order had; `added` says how many went in
 * @returns {Promise<{ cart: object, skipped: object[] }>}
 */
export async function reorder(userId, order) {
  const cart = await getOrCreateCart(userId);
  const products = await Product.find({ _id: { $in: order.items.map((i) => i.product) } });
  const productMap = new Map(products.map((p) => [p.id, p]));
  const skipped = [];

  for (const item of order.items) {
    const productId = item.product.toString();
    const variantId = item.variantId ? item.variantId.toString() : null;
    const sellable = resolveSellable(productMap.get(productId), variantId);
    const entry = (reason, added) => ({
      productId,
      variantId,
      variantLabel: item.variantLabel ? { en: item.variantLabel.en, hi: item.variantLabel.hi } : null,
      title: { en: item.title.en, hi: item.title.hi },
      reason,
      requested: item.qty,
      added,
    });

    // Product / variant switched off or deleted (or a plain item whose product has variants now): nothing to add.
    if (!sellable.available) {
      skipped.push(entry('inactive', 0));
      continue;
    }

    const line = cart.items.find((i) => sameLine(i, productId, variantId));
    const room = sellable.stock - (line ? line.qty : 0);
    if (room <= 0) {
      skipped.push(entry('out_of_stock', 0));
      continue;
    }

    const add = Math.min(item.qty, room);
    if (line) {
      line.qty += add;
      line.priceAtAdd = sellable.price;
    } else {
      cart.items.push({ product: productId, variantId, qty: add, priceAtAdd: sellable.price });
    }
    if (add < item.qty) skipped.push(entry('qty_reduced', add));
  }

  await cart.save();
  return { cart: await buildCartView(cart), skipped };
}

export { getOrCreateCart, buildCartView };
