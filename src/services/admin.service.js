import { Order } from '../models/Order.js';
import { Product } from '../models/Product.js';
import { User } from '../models/User.js';
import { env } from '../config/env.js';
import { startOfStoreDay } from '../utils/dates.js';
import { containsRegex } from '../utils/regex.js';
import { paginateQuery } from '../utils/mongoosePlugins.js';

/**
 * Dashboard numbers. Money in paise. "Today" is the store-local (IST) day, not the server's UTC day.
 *  - todayOrders / todayRevenue: orders placed today, excluding cancelled orders and orders whose
 *    payment failed or was refunded (they didn't earn anything).
 *  - pendingOrders: placed + confirmed + packed (all-time backlog).
 *  - lowStockCount: ACTIVE products at or below LOW_STOCK_THRESHOLD (includes out of stock).
 *  - totalCustomers: users with role "customer".
 */
export async function getDashboardStats() {
  const todayStart = startOfStoreDay();
  const earning = { status: { $ne: 'cancelled' }, paymentStatus: { $nin: ['failed', 'refunded'] } };

  const [today, pendingOrders, outForDelivery, lowStockCount, totalCustomers] = await Promise.all([
    Order.aggregate([
      { $match: { createdAt: { $gte: todayStart }, ...earning } },
      { $group: { _id: null, orders: { $sum: 1 }, revenue: { $sum: '$pricing.total' } } },
    ]),
    Order.countDocuments({ status: { $in: ['placed', 'confirmed', 'packed'] } }),
    Order.countDocuments({ status: 'out_for_delivery' }),
    Product.countDocuments({ isActive: true, stock: { $lte: env.lowStockThreshold } }),
    User.countDocuments({ role: 'customer' }),
  ]);

  return {
    todayOrders: today[0]?.orders ?? 0,
    todayRevenue: today[0]?.revenue ?? 0,
    pendingOrders,
    outForDelivery,
    lowStockCount,
    totalCustomers,
  };
}

/** Customers (role = customer), newest first, with how many orders each has placed. */
export async function listCustomers({ page, limit, q }) {
  const filter = { role: 'customer' };
  if (q) {
    const rx = containsRegex(q);
    filter.$or = [{ name: rx }, { mobile: rx }];
  }

  const result = await paginateQuery(User, filter, {
    page,
    limit,
    sort: { createdAt: -1 },
    select: 'name mobile email isVerified createdAt',
  });

  const counts = await Order.aggregate([
    { $match: { user: { $in: result.docs.map((u) => u._id) } } },
    { $group: { _id: '$user', count: { $sum: 1 } } },
  ]);
  const countByUser = new Map(counts.map((c) => [c._id.toString(), c.count]));

  return {
    ...result,
    docs: result.docs.map((u) => ({
      id: u.id,
      name: u.name,
      mobile: u.mobile,
      email: u.email ?? null,
      isVerified: u.isVerified,
      ordersCount: countByUser.get(u.id) ?? 0,
      createdAt: u.createdAt,
    })),
  };
}

/** Admin product list: inactive included, substring search, optional low-stock / active / category filters. */
export async function listAdminProducts({ page, limit, q, category, isActive, lowStock }) {
  const filter = {};
  if (category) filter.category = category;
  if (isActive !== undefined) filter.isActive = isActive;
  if (lowStock) filter.stock = { $lte: env.lowStockThreshold };
  if (q) {
    const rx = containsRegex(q);
    filter.$or = [{ 'title.en': rx }, { 'title.hi': rx }, { slug: rx }, { brand: rx }, { tags: rx }];
  }

  return paginateQuery(Product, filter, {
    page,
    limit,
    sort: { createdAt: -1 },
    populate: { path: 'category', select: 'name slug' },
  });
}
