import crypto from 'crypto';
import { Order } from '../models/Order.js';
import { User } from '../models/User.js';
import { env } from '../config/env.js';
import { ApiError } from '../utils/ApiError.js';
import { ErrorCodes } from '../utils/errorCodes.js';
import { containsRegex } from '../utils/regex.js';
import { paginateQuery } from '../utils/mongoosePlugins.js';
import { generateDeliveryOtp } from '../utils/generators.js';
import { notifyOrderStatusChange, notifyRiderAssigned, notifyRiderUnassigned } from './push.service.js';
import { assertUsernameFree, hashPassword, mapUsernameDuplicate, setPassword } from './staff-auth.service.js';

const ACTIVE_DELIVERY_STATUSES = ['confirmed', 'packed', 'shipped', 'out_for_delivery'];
const CUSTOMER_CARD = { path: 'user', select: 'name mobile' };

// ================================================================== admin: manage riders

const serializeRider = (u, activeOrders = 0) => ({
  id: u.id,
  name: u.name,
  mobile: u.mobile,
  username: u.username ?? null, // null for a rider created before username login existed: set one with PATCH
  isActive: u.isActive,
  activeOrders,
  createdAt: u.createdAt,
});

async function activeOrderCounts(riderIds) {
  const rows = await Order.aggregate([
    { $match: { rider: { $in: riderIds }, status: { $in: ACTIVE_DELIVERY_STATUSES } } },
    { $group: { _id: '$rider', count: { $sum: 1 } } },
  ]);
  return new Map(rows.map((r) => [r._id.toString(), r.count]));
}

export async function listRiders({ page, limit, q, isActive }) {
  const filter = { role: 'rider' };
  if (isActive !== undefined) filter.isActive = isActive;
  if (q) {
    const rx = containsRegex(q);
    filter.$or = [{ name: rx }, { mobile: rx }, { username: rx }];
  }
  const result = await paginateQuery(User, filter, { page, limit, sort: { createdAt: -1 }, select: 'name mobile username isActive createdAt' });
  const counts = await activeOrderCounts(result.docs.map((u) => u._id));
  return { ...result, docs: result.docs.map((u) => serializeRider(u, counts.get(u.id) ?? 0)) };
}

/**
 * Riders sign in with username + password (POST /auth/staff/login). The mobile is kept for calls and push, and must not
 * belong to anyone else (a customer account cannot be turned into a rider).
 */
export async function createRider({ name, mobile, username, password, isActive }) {
  if (await User.exists({ mobile })) {
    throw ApiError.conflict(ErrorCodes.MOBILE_ALREADY_REGISTERED, 'This mobile number is already registered');
  }
  await assertUsernameFree(username);
  try {
    const rider = await User.create({
      name,
      mobile,
      username,
      passwordHash: await hashPassword(password),
      passwordChangedAt: new Date(),
      role: 'rider',
      isVerified: true,
      isActive,
    });
    return serializeRider(rider, 0);
  } catch (err) {
    throw mapUsernameDuplicate(err);
  }
}

export async function updateRider(id, patch) {
  const rider = await User.findOne({ _id: id, role: 'rider' });
  if (!rider) throw ApiError.notFound(ErrorCodes.RIDER_NOT_FOUND, 'Rider not found');

  const { password, ...fields } = patch;
  if (fields.mobile && fields.mobile !== rider.mobile && (await User.exists({ mobile: fields.mobile }))) {
    throw ApiError.conflict(ErrorCodes.MOBILE_ALREADY_REGISTERED, 'This mobile number is already registered');
  }
  if (fields.username && fields.username !== rider.username) await assertUsernameFree(fields.username, rider._id);
  if (password && !(fields.username ?? rider.username)) {
    // a rider from before username login has none yet: it must be given together with the password
    throw ApiError.badRequest(ErrorCodes.VALIDATION_ERROR, 'Request validation failed', [
      { path: 'username', message: 'This rider has no username yet: send one together with the password' },
    ]);
  }

  Object.assign(rider, fields);
  try {
    if (password) await setPassword(rider, password); // saves; also ends all of this rider's sessions
    else await rider.save();
  } catch (err) {
    throw mapUsernameDuplicate(err);
  }
  const counts = await activeOrderCounts([rider._id]);
  return serializeRider(rider, counts.get(rider.id) ?? 0);
}

/** Admin: assign (or, with riderId null, unassign) a rider. Also makes sure the order has a delivery OTP. */
export async function assignRider(orderId, riderId) {
  const order = await Order.findById(orderId);
  if (!order) throw ApiError.notFound(ErrorCodes.ORDER_NOT_FOUND, 'Order not found');
  if (['delivered', 'cancelled'].includes(order.status)) {
    throw ApiError.badRequest(ErrorCodes.ORDER_NOT_ASSIGNABLE, `A ${order.status} order cannot be assigned to a rider`);
  }

  if (riderId !== null) {
    const rider = await User.findOne({ _id: riderId, role: 'rider' });
    if (!rider) throw ApiError.notFound(ErrorCodes.RIDER_NOT_FOUND, 'Rider not found');
    if (!rider.isActive) throw ApiError.badRequest(ErrorCodes.ORDER_NOT_ASSIGNABLE, 'This rider is inactive');
  }

  const previousRiderId = order.rider ? order.rider.toString() : null;
  order.rider = riderId;
  // Orders placed before delivery OTPs existed get one now, so every delivery is OTP-protected.
  if (riderId !== null && !order.deliveryOtp) order.deliveryOtp = generateDeliveryOtp();
  await order.save();

  // Push (fire-and-forget; never contains the customer's phone or the delivery OTP). Re-assigning the same rider is a no-op.
  if (riderId !== previousRiderId) {
    if (riderId !== null) notifyRiderAssigned(riderId, order);
    if (previousRiderId !== null) notifyRiderUnassigned(previousRiderId, order);
  }
  return order.populate([CUSTOMER_CARD, { path: 'rider', select: 'name mobile' }]);
}

// ================================================================== rider app

export async function listRiderOrders(riderId, { page, limit, status }) {
  const filter = { rider: riderId };
  if (status) filter.status = status;
  return paginateQuery(Order, filter, { page, limit, sort: { createdAt: -1 }, populate: CUSTOMER_CARD });
}

/** 404 when the order doesn't exist OR belongs to another rider — never reveal which. */
async function findAssignedOrder(riderId, orderId) {
  const order = await Order.findOne({ _id: orderId, rider: riderId });
  if (!order) throw ApiError.notFound(ErrorCodes.ORDER_NOT_FOUND, 'Order not found');
  return order;
}

const invalidState = (order, expected) =>
  ApiError.badRequest(ErrorCodes.INVALID_ORDER_STATE, `Order is "${order.status}", expected ${expected}`, { status: order.status });

export async function markOutForDelivery(riderId, orderId) {
  const current = await findAssignedOrder(riderId, orderId);
  const order = await Order.findOneAndUpdate(
    { _id: orderId, rider: riderId, status: { $in: ['confirmed', 'packed', 'shipped'] } },
    {
      $set: { status: 'out_for_delivery' },
      $push: { statusHistory: { status: 'out_for_delivery', at: new Date(), note: 'Out for delivery with rider' } },
    },
    { new: true }
  );
  if (!order) throw invalidState(current, 'confirmed, packed or shipped');

  notifyOrderStatusChange(order);
  return order.populate(CUSTOMER_CARD);
}

function otpMatches(expected, given) {
  const a = Buffer.from(String(expected ?? ''));
  const b = Buffer.from(String(given));
  return a.length > 0 && a.length === b.length && crypto.timingSafeEqual(a, b);
}

/**
 * Completes a delivery. The customer's 4-digit OTP is mandatory. Each wrong guess burns one of
 * DELIVERY_OTP_MAX_ATTEMPTS attempts (counted atomically, so parallel requests can't out-race the cap);
 * once they're gone the order is locked and an admin has to close it from the admin panel.
 * For unpaid COD orders the rider must report cashCollected (paise); the order is then marked paid.
 */
export async function deliverOrder(riderId, orderId, { otp, cashCollected }) {
  const current = await findAssignedOrder(riderId, orderId);
  if (current.status !== 'out_for_delivery') throw invalidState(current, 'out_for_delivery');

  const owesCash = current.paymentMethod === 'cod' && current.paymentStatus !== 'paid';
  if (owesCash && cashCollected === undefined) {
    throw ApiError.badRequest(ErrorCodes.VALIDATION_ERROR, 'cashCollected (paise) is required for a COD order');
  }
  if (!owesCash && cashCollected) {
    throw ApiError.badRequest(ErrorCodes.VALIDATION_ERROR, 'cashCollected is only for unpaid COD orders');
  }

  // Burn an attempt BEFORE comparing, atomically.
  const attempted = await Order.findOneAndUpdate(
    { _id: orderId, rider: riderId, status: 'out_for_delivery', deliveryOtpAttempts: { $lt: env.deliveryOtpMaxAttempts } },
    { $inc: { deliveryOtpAttempts: 1 } },
    { new: true }
  );
  if (!attempted) {
    const latest = await findAssignedOrder(riderId, orderId);
    if (latest.status !== 'out_for_delivery') throw invalidState(latest, 'out_for_delivery');
    throw ApiError.tooMany(ErrorCodes.DELIVERY_OTP_LOCKED, 'Too many wrong OTP attempts. Ask the store to complete this delivery.');
  }

  if (!otpMatches(attempted.deliveryOtp, otp)) {
    throw ApiError.badRequest(ErrorCodes.INVALID_DELIVERY_OTP, 'The delivery OTP is incorrect', {
      attemptsLeft: Math.max(0, env.deliveryOtpMaxAttempts - attempted.deliveryOtpAttempts),
    });
  }

  const $set = { status: 'delivered', cashCollected: owesCash ? cashCollected : null };
  if (owesCash) $set.paymentStatus = 'paid';

  const delivered = await Order.findOneAndUpdate(
    { _id: orderId, rider: riderId, status: 'out_for_delivery' },
    { $set, $push: { statusHistory: { status: 'delivered', at: new Date(), note: 'Delivered (OTP verified)' } } },
    { new: true }
  );
  if (!delivered) throw invalidState(await findAssignedOrder(riderId, orderId), 'out_for_delivery');

  notifyOrderStatusChange(delivered);
  return delivered.populate(CUSTOMER_CARD);
}
