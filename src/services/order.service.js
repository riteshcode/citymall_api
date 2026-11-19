import mongoose from 'mongoose';
import { Order } from '../models/Order.js';
import { Cart } from '../models/Cart.js';
import { Product } from '../models/Product.js';
import { Coupon } from '../models/Coupon.js';
import { CouponRedemption } from '../models/CouponRedemption.js';
import { User } from '../models/User.js';
import { ApiError } from '../utils/ApiError.js';
import { ErrorCodes } from '../utils/errorCodes.js';
import { buildPricing, computeSubtotal } from './pricing.service.js';
import { getEligibleCoupon, recordCouponRedemption } from './coupon.service.js';
import { generateOrderNumber, generateDeliveryOtp } from '../utils/generators.js';
import { paginateQuery } from '../utils/mongoosePlugins.js';
import { containsRegex } from '../utils/regex.js';
import { parseDateBoundary } from '../utils/dates.js';
import { getSettings } from './settings.service.js';
import { notifyOrderStatusChange } from './push.service.js';
import { refundOnCancel } from './refund.service.js';
import { resolveDelivery, expectedDeliveryAt } from './serviceability.service.js';
import { resolveSellable, reserveStock, releaseStock } from '../utils/variants.js';

const CANCELLABLE_STATUSES = ['placed', 'confirmed', 'packed'];

/**
 * Places an order for the user's current cart. Idempotent on
 * `idempotencyKey`: a retried request with the same key returns the
 * original order instead of creating a duplicate. Re-validates stock,
 * price and coupon eligibility from scratch inside a transaction — the
 * cart's cached state is never trusted.
 */
export async function createOrder(userId, { addressId, paymentMethod, idempotencyKey, deliveryNote = '' }) {
  const existing = await Order.findOne({ idempotencyKey, user: userId });
  if (existing) return existing;

  // Read the admin-configurable store rules once, outside the transaction.
  const settings = await getSettings();
  if (!settings.storeOpen) {
    throw new ApiError(503, ErrorCodes.STORE_CLOSED, 'The store is currently closed and not accepting orders', {
      storeTimings: { open: settings.storeTimings.open, close: settings.storeTimings.close },
    });
  }

  const session = await mongoose.startSession();
  try {
    let order;

    await session.withTransaction(async () => {
      const user = await User.findById(userId).session(session);
      const address = user.addresses.find((a) => a._id.toString() === addressId);
      if (!address) {
        throw ApiError.notFound(ErrorCodes.ADDRESS_NOT_FOUND, 'Shipping address not found');
      }

      const delivery = await resolveDelivery(address.pincode);
      if (!delivery.serviceable) {
        throw ApiError.badRequest(ErrorCodes.NOT_SERVICEABLE, 'We do not deliver to this pincode yet', {
          pincode: address.pincode,
        });
      }

      const cart = await Cart.findOne({ user: userId }).session(session);
      if (!cart || cart.items.length === 0) {
        throw ApiError.badRequest(ErrorCodes.CART_EMPTY, 'Your cart is empty');
      }

      const productIds = cart.items.map((i) => i.product);
      const products = await Product.find({ _id: { $in: productIds } }).session(session);
      const productMap = new Map(products.map((p) => [p.id, p]));

      const orderItems = [];
      const lineItems = [];

      for (const item of cart.items) {
        const product = productMap.get(item.product.toString());
        const sellable = resolveSellable(product, item.variantId);
        if (!sellable.available) {
          // inactive / deleted product or variant, or a cart line that predates the product getting variants
          throw ApiError.badRequest(ErrorCodes.OUT_OF_STOCK, 'One of the items in your cart is no longer available', {
            productId: item.product.toString(),
            variantId: item.variantId ? item.variantId.toString() : null,
          });
        }
        const name = sellable.variantLabel ? `${product.title.en} (${sellable.variantLabel.en})` : product.title.en;
        if (sellable.stock < item.qty) {
          throw ApiError.badRequest(
            ErrorCodes.INSUFFICIENT_STOCK,
            `Only ${sellable.stock} unit(s) of "${name}" are available`,
            { productId: product.id, variantId: sellable.variantId, available: sellable.stock }
          );
        }
        orderItems.push({
          product: product._id,
          variantId: sellable.variantId,
          variantLabel: sellable.variantLabel,
          title: { en: product.title.en, hi: product.title.hi },
          image: sellable.image,
          unit: sellable.unit,
          price: sellable.price,
          qty: item.qty,
        });
        lineItems.push({ price: sellable.price, qty: item.qty });
      }

      const subtotal = computeSubtotal(lineItems);
      if (settings.minOrderValue > 0 && subtotal < settings.minOrderValue) {
        throw ApiError.badRequest(
          ErrorCodes.MIN_ORDER_VALUE,
          'Your order is below the minimum order value',
          { minOrderValue: settings.minOrderValue, subtotal }
        );
      }

      let coupon = null;
      if (cart.couponCode) {
        coupon = await getEligibleCoupon(cart.couponCode, { subtotal, userId, session });
      }

      const pricing = buildPricing({
        lineItems,
        coupon,
        settings,
        deliveryFeeOverride: delivery.deliveryFeeOverride,
      });

      // Atomic, condition-checked stock decrement (from the chosen variant, if any) — guards against oversell
      // under concurrent orders.
      for (const item of cart.items) {
        const product = productMap.get(item.product.toString());
        const reserved = await reserveStock(product._id, item.variantId, item.qty, session);
        if (!reserved) {
          throw ApiError.badRequest(
            ErrorCodes.OUT_OF_STOCK,
            `"${product.title.en}" just went out of stock`,
            { productId: product.id, variantId: item.variantId ? item.variantId.toString() : null }
          );
        }
      }

      const created = await Order.create(
        [
          {
            orderNumber: generateOrderNumber(),
            user: userId,
            items: orderItems,
            pricing,
            couponCode: coupon ? coupon.code : null,
            shippingAddress: address.toObject(),
            paymentMethod,
            paymentStatus: 'pending',
            status: 'placed',
            statusHistory: [{ status: 'placed', at: new Date() }],
            expectedDeliveryAt: expectedDeliveryAt(delivery),
            idempotencyKey,
            deliveryNote,
            deliveryOtp: generateDeliveryOtp(),
          },
        ],
        { session }
      );
      order = created[0];

      if (coupon) {
        await recordCouponRedemption(coupon, { userId, orderId: order._id, session });
      }

      cart.items = [];
      cart.couponCode = null;
      await cart.save({ session });
    });

    return order;
  } catch (err) {
    if (err?.code === 11000 && err?.keyPattern?.idempotencyKey) {
      const replay = await Order.findOne({ idempotencyKey, user: userId });
      if (replay) return replay;
    }
    throw err;
  } finally {
    await session.endSession();
  }
}

export async function listOrders(userId, { page, limit }) {
  return paginateQuery(Order, { user: userId }, { page, limit, sort: { createdAt: -1 } });
}

/**
 * Admin: every user's orders, newest first.
 * Filters: status; from/to on createdAt (date-only values cover the whole IST day);
 * q = orderNumber substring OR customer mobile substring.
 */
export async function listAllOrders({ page, limit, status, from, to, q }) {
  const filter = {};
  if (status) filter.status = status;

  if (from || to) {
    filter.createdAt = {};
    if (from) filter.createdAt.$gte = parseDateBoundary(from, 'start');
    if (to) filter.createdAt.$lte = parseDateBoundary(to, 'end');
  }

  if (q) {
    const rx = containsRegex(q);
    // Capped: a 1-2 digit q can match a lot of mobiles; the orderNumber branch still applies in full.
    const userIds = await User.find({ mobile: rx }).select('_id').limit(1000).lean();
    filter.$or = [{ orderNumber: rx }, { user: { $in: userIds.map((u) => u._id) } }];
  }

  return paginateQuery(Order, filter, {
    page,
    limit,
    sort: { createdAt: -1 },
    populate: [
      { path: 'user', select: 'name mobile' },
      { path: 'rider', select: 'name mobile' }, // null while unassigned
    ],
  });
}

/** Admin new-order alert: how many orders came in after `since`, plus the newest 10. Cheap enough to poll. */
export async function listLatestOrders(since) {
  const filter = { createdAt: { $gt: since } };
  const [count, orders] = await Promise.all([
    Order.countDocuments(filter),
    Order.find(filter).sort({ createdAt: -1 }).limit(10).select('orderNumber pricing.total createdAt').lean(),
  ]);
  return {
    count,
    orders: orders.map((o) => ({ id: o._id.toString(), orderNumber: o.orderNumber, total: o.pricing.total, createdAt: o.createdAt })),
  };
}

export async function getOrderById(userId, orderId, { isAdmin = false } = {}) {
  const filter = isAdmin ? { _id: orderId } : { _id: orderId, user: userId };
  const query = Order.findOne(filter);
  // Admin gets the full customer card alongside the order.
  if (isAdmin) {
    query.populate({ path: 'user', select: 'name mobile email isVerified createdAt' });
    query.populate({ path: 'rider', select: 'name mobile' });
  }
  const order = await query;
  if (!order) {
    throw ApiError.notFound(ErrorCodes.ORDER_NOT_FOUND, 'Order not found');
  }
  return order;
}

/**
 * The ONE place an order gets cancelled (customer cancel and admin status "cancelled" both end up here).
 * In a single transaction it atomically claims the cancellation (status -> cancelled, only if it is not cancelled yet),
 * puts the stock back into the SAME variants and gives back the coupon redemption. Because the claim is atomic, a second
 * or concurrent cancel finds the order already cancelled and changes nothing (no double stock, no double coupon).
 * After the commit a paid online order is refunded through the gateway (see refund.service.js).
 *
 * @param {object} claimFilter which order, and from which states it may be cancelled
 * @returns {Promise<{ order: object|null, changed: boolean }>} order null = nothing matched the filter
 */
async function cancelOrderNow(claimFilter, reason) {
  const session = await mongoose.startSession();
  let order = null;
  let changed = false;
  try {
    await session.withTransaction(async () => {
      changed = false;
      order = await Order.findOneAndUpdate(
        { ...claimFilter, status: claimFilter.status ?? { $ne: 'cancelled' } },
        { $set: { status: 'cancelled', cancelReason: reason }, $push: { statusHistory: { status: 'cancelled', at: new Date(), note: reason } } },
        { new: true, session }
      );
      if (!order) return;
      changed = true;

      for (const item of order.items) {
        await releaseStock(item.product, item.variantId, item.qty, session); // back into the same variant
      }

      // The coupon was used by this order: free it again (usedCount down, the user's per-user limit free).
      const redemption = await CouponRedemption.findOneAndDelete({ order: order._id }, { session });
      if (redemption) {
        await Coupon.updateOne({ _id: redemption.coupon, usedCount: { $gt: 0 } }, { $inc: { usedCount: -1 } }, { session });
      }
    });
  } finally {
    await session.endSession();
  }
  return { order, changed };
}

/** Money side of a cancellation, after the commit. Never throws: the cancellation stands even if the gateway is down. */
async function settlePaymentAfterCancel(order, reason) {
  if (order.paymentStatus !== 'paid') return order;
  if (order.paymentMethod === 'cod') {
    // cash that was already collected: nothing to send through a gateway, the shop returns it by hand
    return (await Order.findByIdAndUpdate(order._id, { paymentStatus: 'refunded' }, { new: true })) ?? order;
  }
  const result = await refundOnCancel(order, reason);
  return result?.order ?? (await Order.findById(order._id));
}

export async function cancelOrder(userId, orderId, reason) {
  const why = reason || 'Cancelled by customer';
  const { order, changed } = await cancelOrderNow({ _id: orderId, user: userId, status: { $in: CANCELLABLE_STATUSES } }, why);
  if (!order || !changed) {
    const current = await Order.findOne({ _id: orderId, user: userId }).select('status');
    if (!current) throw ApiError.notFound(ErrorCodes.ORDER_NOT_FOUND, 'Order not found');
    throw ApiError.badRequest(ErrorCodes.ORDER_NOT_CANCELLABLE, `Order cannot be cancelled once it is "${current.status}"`);
  }
  return settlePaymentAfterCancel(order, why);
}

/**
 * Admin: transitions order status and appends a statusHistory entry.
 * "cancelled" does everything a customer cancel does (stock, coupon, refund) and is idempotent; a cancelled order
 * cannot be re-opened (its stock and refund are already settled).
 */
export async function updateOrderStatus(orderId, status, note) {
  if (status === 'cancelled') {
    const why = note || 'Cancelled by admin';
    const { order, changed } = await cancelOrderNow({ _id: orderId }, why);
    if (!order) {
      const existing = await Order.findById(orderId);
      if (!existing) throw ApiError.notFound(ErrorCodes.ORDER_NOT_FOUND, 'Order not found');
      return existing; // already cancelled: nothing to do again
    }
    const settled = await settlePaymentAfterCancel(order, why);
    if (changed) notifyOrderStatusChange(settled);
    return settled;
  }

  const order = await Order.findById(orderId);
  if (!order) {
    throw ApiError.notFound(ErrorCodes.ORDER_NOT_FOUND, 'Order not found');
  }
  if (order.status === 'cancelled') {
    throw ApiError.badRequest(ErrorCodes.INVALID_ORDER_STATE, 'A cancelled order cannot be re-opened', { status: order.status });
  }
  order.status = status;
  order.statusHistory.push({ status, at: new Date(), note: note || '' });
  await order.save();
  notifyOrderStatusChange(order);
  return order;
}

/**
 * The customer-facing shape of an order: the normal JSON plus the delivery OTP (which the model otherwise strips
 * from every serialisation). Only the order's OWNER ever gets this — never admin or rider responses.
 */
export function customerOrderJSON(order) {
  return { ...order.toJSON(), deliveryOtp: order.deliveryOtp ?? null };
}
