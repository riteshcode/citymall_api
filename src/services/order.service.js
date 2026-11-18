import mongoose from 'mongoose';
import { Order } from '../models/Order.js';
import { Cart } from '../models/Cart.js';
import { Product } from '../models/Product.js';
import { User } from '../models/User.js';
import { ApiError } from '../utils/ApiError.js';
import { ErrorCodes } from '../utils/errorCodes.js';
import { buildPricing, computeSubtotal } from './pricing.service.js';
import { getEligibleCoupon, recordCouponRedemption } from './coupon.service.js';
import { generateOrderNumber } from '../utils/generators.js';
import { paginateQuery } from '../utils/mongoosePlugins.js';
import { containsRegex } from '../utils/regex.js';
import { parseDateBoundary } from '../utils/dates.js';
import { getSettings } from './settings.service.js';
import { resolveDelivery } from './serviceability.service.js';

const CANCELLABLE_STATUSES = ['placed', 'confirmed', 'packed'];

/**
 * Places an order for the user's current cart. Idempotent on
 * `idempotencyKey`: a retried request with the same key returns the
 * original order instead of creating a duplicate. Re-validates stock,
 * price and coupon eligibility from scratch inside a transaction — the
 * cart's cached state is never trusted.
 */
export async function createOrder(userId, { addressId, paymentMethod, idempotencyKey }) {
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
        if (!product || !product.isActive) {
          throw ApiError.badRequest(ErrorCodes.OUT_OF_STOCK, 'One of the items in your cart is no longer available');
        }
        if (product.stock < item.qty) {
          throw ApiError.badRequest(
            ErrorCodes.INSUFFICIENT_STOCK,
            `Only ${product.stock} unit(s) of "${product.title.en}" are available`,
            { productId: product.id, available: product.stock }
          );
        }
        orderItems.push({
          product: product._id,
          title: { en: product.title.en, hi: product.title.hi },
          image: product.images[0] || '',
          unit: product.unit,
          price: product.price,
          qty: item.qty,
        });
        lineItems.push({ price: product.price, qty: item.qty });
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

      // Atomic, condition-checked stock decrement — guards against oversell under concurrent orders.
      for (const item of cart.items) {
        const product = productMap.get(item.product.toString());
        const result = await Product.updateOne(
          { _id: product._id, stock: { $gte: item.qty } },
          { $inc: { stock: -item.qty } },
          { session }
        );
        if (result.matchedCount === 0) {
          throw ApiError.badRequest(
            ErrorCodes.OUT_OF_STOCK,
            `"${product.title.en}" just went out of stock`,
            { productId: product.id }
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
            expectedDeliveryAt: new Date(Date.now() + delivery.etaDays * 24 * 60 * 60 * 1000),
            idempotencyKey,
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
    populate: { path: 'user', select: 'name mobile' },
  });
}

export async function getOrderById(userId, orderId, { isAdmin = false } = {}) {
  const filter = isAdmin ? { _id: orderId } : { _id: orderId, user: userId };
  const query = Order.findOne(filter);
  // Admin gets the full customer card alongside the order.
  if (isAdmin) query.populate({ path: 'user', select: 'name mobile email isVerified createdAt' });
  const order = await query;
  if (!order) {
    throw ApiError.notFound(ErrorCodes.ORDER_NOT_FOUND, 'Order not found');
  }
  return order;
}

export async function cancelOrder(userId, orderId, reason) {
  const session = await mongoose.startSession();
  try {
    let order;
    await session.withTransaction(async () => {
      order = await Order.findOne({ _id: orderId, user: userId }).session(session);
      if (!order) {
        throw ApiError.notFound(ErrorCodes.ORDER_NOT_FOUND, 'Order not found');
      }
      if (!CANCELLABLE_STATUSES.includes(order.status)) {
        throw ApiError.badRequest(
          ErrorCodes.ORDER_NOT_CANCELLABLE,
          `Order cannot be cancelled once it is "${order.status}"`
        );
      }

      for (const item of order.items) {
        await Product.updateOne({ _id: item.product }, { $inc: { stock: item.qty } }, { session });
      }

      order.status = 'cancelled';
      order.cancelReason = reason || 'Cancelled by customer';
      order.statusHistory.push({ status: 'cancelled', at: new Date(), note: order.cancelReason });
      if (order.paymentStatus === 'paid') {
        order.paymentStatus = 'refunded';
      }
      await order.save({ session });
    });
    return order;
  } finally {
    await session.endSession();
  }
}

/** Admin: transitions order status and appends a statusHistory entry. */
export async function updateOrderStatus(orderId, status, note) {
  const order = await Order.findById(orderId);
  if (!order) {
    throw ApiError.notFound(ErrorCodes.ORDER_NOT_FOUND, 'Order not found');
  }
  order.status = status;
  order.statusHistory.push({ status, at: new Date(), note: note || '' });
  await order.save();
  return order;
}
