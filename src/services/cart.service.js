import { Cart } from '../models/Cart.js';
import { Product } from '../models/Product.js';
import { ApiError } from '../utils/ApiError.js';
import { ErrorCodes } from '../utils/errorCodes.js';
import { buildPricing, computeSubtotal } from './pricing.service.js';
import { getEligibleCoupon } from './coupon.service.js';
import { getSettings } from './settings.service.js';
import { resolveDelivery } from './serviceability.service.js';

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
    const isAvailable = Boolean(product && product.isActive);

    if (isAvailable) {
      lineItems.push({ price: product.price, qty: item.qty });
    }

    responseItems.push({
      productId: item.product.toString(),
      title: product ? product.title : null,
      slug: product ? product.slug : null,
      image: product?.images?.[0] || '',
      unit: product ? product.unit : null,
      price: product ? product.price : item.priceAtAdd,
      mrp: product ? product.mrp : null,
      qty: item.qty,
      stock: product ? product.stock : 0,
      isAvailable,
      inStock: isAvailable && product.stock >= item.qty,
      lineTotal: isAvailable ? product.price * item.qty : 0,
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

export async function addItem(userId, productId, qty) {
  const product = await Product.findById(productId);
  if (!product || !product.isActive) {
    throw ApiError.notFound(ErrorCodes.PRODUCT_NOT_FOUND, 'Product not found');
  }

  const cart = await getOrCreateCart(userId);
  const existing = cart.items.find((i) => i.product.toString() === productId);

  if (existing) {
    existing.qty += qty;
    existing.priceAtAdd = product.price;
  } else {
    cart.items.push({ product: product._id, qty, priceAtAdd: product.price });
  }

  await cart.save();
  return buildCartView(cart);
}

export async function updateItemQty(userId, productId, qty) {
  const cart = await getOrCreateCart(userId);
  const idx = cart.items.findIndex((i) => i.product.toString() === productId);

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

export async function removeItem(userId, productId) {
  return updateItemQty(userId, productId, 0);
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
  const products = await Product.find({ _id: { $in: productIds }, isActive: true });
  const productMap = new Map(products.map((p) => [p.id, p]));
  const lineItems = cart.items
    .filter((i) => productMap.has(i.product.toString()))
    .map((i) => ({ price: productMap.get(i.product.toString()).price, qty: i.qty }));

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

export { getOrCreateCart, buildCartView };
